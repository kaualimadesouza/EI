import uuid
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from topa_api.domain.fiscal import (
    build_fiscal_document,
    get_store_fiscal_profile,
)
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod
from topa_api.domain.pos_integration import (
    BufferPrinterTransport,
    CatalogProductMapper,
    CompositePosAdapter,
    ExternalProductMapping,
    FileDropPosAdapter,
    PosMechanismType,
    ThermalPrinterPosAdapter,
    WebhookPosAdapter,
)

SP_TZ = ZoneInfo("America/Sao_Paulo")


def _sample_order() -> Order:
    return Order(
        id=uuid.uuid4(),
        store_slug="lanchonete-bem-te-vi",
        number=7,
        business_date=date(2026, 10, 30),
        status=OrderStatus.PREPARING,
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        items=(
            OrderItem("misto", "Misto Quente", 1, 1200),
            OrderItem("suco", "Suco de Laranja", 2, 800),
        ),
        created_at=datetime(2026, 10, 30, 14, 0, 0, tzinfo=SP_TZ),
    )


def test_catalog_product_mapper() -> None:
    custom_map = ExternalProductMapping(
        internal_product_id="misto",
        external_sku="SKU-SANDWICH-1",
        plu_code="1001",
    )
    mapper = CatalogProductMapper([custom_map])
    mapped_misto = mapper.map_product("misto")
    assert mapped_misto.external_sku == "SKU-SANDWICH-1"
    assert mapped_misto.plu_code == "1001"

    fallback = mapper.map_product("desconhecido")
    assert fallback.external_sku == "SKU-DESCONHECIDO"
    assert len(fallback.plu_code) >= 4


def test_file_drop_adapter_json_and_xml(tmp_path: Path) -> None:
    order = _sample_order()
    profile = get_store_fiscal_profile(order.store_slug)
    fiscal_doc = build_fiscal_document(order, profile)

    # JSON export
    adapter_json = FileDropPosAdapter(tmp_path / "drop_json", file_format="json")
    res_json = adapter_json.export_order(order, profile, fiscal_doc)
    assert res_json.success is True
    assert res_json.mechanism == PosMechanismType.FILE_DROP
    assert Path(res_json.destination).exists()

    # XML export with fiscal doc
    adapter_xml = FileDropPosAdapter(tmp_path / "drop_xml", file_format="xml")
    res_xml = adapter_xml.export_order(order, profile, fiscal_doc)
    assert res_xml.success is True
    assert "<NFe" in Path(res_xml.destination).read_text(encoding="utf-8")

    # XML export without fiscal doc
    res_xml_raw = adapter_xml.export_order(order, profile, None)
    assert res_xml_raw.success is True
    assert "<order>" in Path(res_xml_raw.destination).read_text(encoding="utf-8")


def test_file_drop_adapter_error(tmp_path: Path) -> None:
    order = _sample_order()
    profile = get_store_fiscal_profile(order.store_slug)
    # Target directory is actually a file to cause mkdir / write error
    conflict_file = tmp_path / "blocked"
    conflict_file.write_text("blocker")

    adapter = FileDropPosAdapter(conflict_file / "sub", file_format="json")
    res = adapter.export_order(order, profile, None)
    assert res.success is False
    assert res.error_message is not None


def test_thermal_printer_adapter_success_and_error() -> None:
    order = _sample_order()
    profile = get_store_fiscal_profile(order.store_slug)
    transport = BufferPrinterTransport()

    adapter = ThermalPrinterPosAdapter(
        transport=transport,
        print_kitchen=True,
        print_customer=True,
    )
    res = adapter.export_order(order, profile, None)
    assert res.success is True
    assert res.mechanism == PosMechanismType.THERMAL_PRINTER
    assert len(transport.spool) == 2

    # Customer receipt only (kitchen False)
    transport_customer = BufferPrinterTransport()
    adapter_cust_only = ThermalPrinterPosAdapter(
        transport=transport_customer,
        print_kitchen=False,
        print_customer=True,
    )
    res_cust = adapter_cust_only.export_order(order, profile, None)
    assert res_cust.success is True
    assert len(transport_customer.spool) == 1

    # Failing transport
    class FailingTransport:
        def send(self, data: bytes) -> None:
            raise OSError("Printer disconnected")

    fail_adapter = ThermalPrinterPosAdapter(transport=FailingTransport())
    res_fail = fail_adapter.export_order(order, profile, None)
    assert res_fail.success is False
    assert "Printer disconnected" in (res_fail.error_message or "")


def test_webhook_adapter_success_and_error() -> None:
    order = _sample_order()
    profile = get_store_fiscal_profile(order.store_slug)

    class MockHttpSender:
        def __init__(self, status_code: int, response_text: str = "ok") -> None:
            self.status_code = status_code
            self.response_text = response_text
            self.calls: list[dict[str, object]] = []

        def post(self, url: str, headers: dict[str, str], payload_bytes: bytes) -> tuple[int, str]:
            self.calls.append({"url": url, "headers": headers, "body": payload_bytes})
            return self.status_code, self.response_text

    # Success (200)
    sender_200 = MockHttpSender(200, "Received")
    adapter = WebhookPosAdapter("https://pos.legacy.test/webhook", "secret-key", sender_200)
    res = adapter.export_order(order, profile, None)
    assert res.success is True
    assert res.mechanism == PosMechanismType.WEBHOOK
    assert len(sender_200.calls) == 1
    assert "X-TOPA-Signature" in sender_200.calls[0]["headers"]  # type: ignore[operator]

    # HTTP Error (500)
    sender_500 = MockHttpSender(500, "Internal Server Error")
    adapter_500 = WebhookPosAdapter("https://pos.legacy.test/webhook", "secret-key", sender_500)
    res_500 = adapter_500.export_order(order, profile, None)
    assert res_500.success is False
    assert "HTTP status 500" in (res_500.error_message or "")

    # Network Exception
    class CrashingSender:
        def post(self, url: str, headers: dict[str, str], payload_bytes: bytes) -> tuple[int, str]:
            raise ConnectionError("DNS lookup failed")

    adapter_crash = WebhookPosAdapter("https://pos.legacy.test/webhook", "key", CrashingSender())
    res_crash = adapter_crash.export_order(order, profile, None)
    assert res_crash.success is False
    assert "DNS lookup failed" in (res_crash.error_message or "")


def test_composite_pos_adapter(tmp_path: Path) -> None:
    order = _sample_order()
    profile = get_store_fiscal_profile(order.store_slug)
    transport = BufferPrinterTransport()

    adapter_print = ThermalPrinterPosAdapter(transport=transport)
    adapter_file = FileDropPosAdapter(tmp_path / "composite_drop")

    composite = CompositePosAdapter([adapter_print, adapter_file])
    results = composite.export_order(order, profile, None)
    assert len(results) == 2
    assert all(r.success for r in results)
