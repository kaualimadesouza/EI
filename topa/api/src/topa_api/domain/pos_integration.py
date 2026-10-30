import hashlib
import hmac
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Protocol
from zoneinfo import ZoneInfo

from topa_api.domain.escpos import render_customer_receipt, render_kitchen_ticket
from topa_api.domain.fiscal import FiscalDocument, StoreFiscalProfile
from topa_api.domain.orders import Order

BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")


class PosMechanismType(StrEnum):
    THERMAL_PRINTER = "thermal_printer"
    FILE_DROP = "file_drop"
    WEBHOOK = "webhook"


@dataclass(frozen=True)
class PosExportResult:
    adapter_name: str
    mechanism: PosMechanismType
    success: bool
    destination: str
    timestamp: datetime
    error_message: str | None = None


@dataclass(frozen=True)
class ExternalProductMapping:
    internal_product_id: str
    external_sku: str
    plu_code: str
    barcode_ean13: str | None = None


class CatalogProductMapper:
    def __init__(self, mappings: Sequence[ExternalProductMapping] | None = None) -> None:
        self._by_internal: dict[str, ExternalProductMapping] = {}
        if mappings:
            for m in mappings:
                self._by_internal[m.internal_product_id] = m

    def map_product(self, internal_id: str) -> ExternalProductMapping:
        if internal_id in self._by_internal:
            return self._by_internal[internal_id]
        return ExternalProductMapping(
            internal_product_id=internal_id,
            external_sku=f"SKU-{internal_id.upper()}",
            plu_code=str(abs(hash(internal_id)) % 9000 + 1000),
        )


class PosAdapterPort(Protocol):
    def export_order(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None = None,
    ) -> PosExportResult: ...


class FileDropPosAdapter:
    def __init__(
        self,
        target_dir: Path,
        file_format: str = "json",
        product_mapper: CatalogProductMapper | None = None,
    ) -> None:
        self._target_dir = target_dir
        self._format = file_format.lower()
        self._mapper = product_mapper or CatalogProductMapper()

    def export_order(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None = None,
    ) -> PosExportResult:
        now = datetime.now(BUSINESS_TIMEZONE)
        try:
            self._target_dir.mkdir(parents=True, exist_ok=True)
            filename_base = f"order_{order.store_slug}_{order.number}_{order.id.hex[:8]}"
            tmp_path = self._target_dir / f"{filename_base}.tmp"
            final_path = self._target_dir / f"{filename_base}.{self._format}"

            if self._format == "xml":
                content = self._render_xml(order, store_profile, fiscal_doc)
            else:
                content = self._render_json(order, store_profile, fiscal_doc)

            tmp_path.write_text(content, encoding="utf-8")
            tmp_path.replace(final_path)

            return PosExportResult(
                adapter_name="FileDropAdapter",
                mechanism=PosMechanismType.FILE_DROP,
                success=True,
                destination=str(final_path),
                timestamp=now,
            )
        except Exception as exc:
            return PosExportResult(
                adapter_name="FileDropAdapter",
                mechanism=PosMechanismType.FILE_DROP,
                success=False,
                destination=str(self._target_dir),
                timestamp=now,
                error_message=str(exc),
            )

    def _render_json(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None,
    ) -> str:
        payload = {
            "order_id": str(order.id),
            "store_slug": order.store_slug,
            "order_number": order.number,
            "business_date": order.business_date.isoformat(),
            "dine_in": order.dine_in,
            "payment_method": order.payment_method.value,
            "total_cents": order.total_cents,
            "fiscal_key": fiscal_doc.access_key if fiscal_doc else None,
            "items": [
                {
                    "product_id": item.product_id,
                    "external_sku": self._mapper.map_product(item.product_id).external_sku,
                    "plu": self._mapper.map_product(item.product_id).plu_code,
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit_price_cents": item.unit_price_cents,
                    "total_cents": item.quantity * item.unit_price_cents,
                }
                for item in order.items
            ],
        }
        return json.dumps(payload, indent=2, ensure_ascii=False)

    def _render_xml(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None,
    ) -> str:
        if fiscal_doc is not None:
            return fiscal_doc.xml_payload
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<order>",
            f"  <id>{order.id}</id>",
            f"  <number>{order.number}</number>",
            f"  <store>{order.store_slug}</store>",
            f"  <totalCents>{order.total_cents}</totalCents>",
            "  <items>",
        ]
        for it in order.items:
            m = self._mapper.map_product(it.product_id)
            lines.extend(
                [
                    "    <item>",
                    f"      <sku>{m.external_sku}</sku>",
                    f"      <plu>{m.plu_code}</plu>",
                    f"      <name>{it.name}</name>",
                    f"      <qty>{it.quantity}</qty>",
                    f"      <priceCents>{it.unit_price_cents}</priceCents>",
                    "    </item>",
                ]
            )
        lines.extend(["  </items>", "</order>"])
        return "\n".join(lines)


class PrinterTransport(Protocol):
    def send(self, data: bytes) -> None: ...


class BufferPrinterTransport:
    def __init__(self) -> None:
        self.spool: list[bytes] = []

    def send(self, data: bytes) -> None:
        self.spool.append(data)


class ThermalPrinterPosAdapter:
    def __init__(
        self,
        transport: PrinterTransport,
        print_kitchen: bool = True,
        print_customer: bool = False,
    ) -> None:
        self._transport = transport
        self._print_kitchen = print_kitchen
        self._print_customer = print_customer

    def export_order(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None = None,
    ) -> PosExportResult:
        now = datetime.now(BUSINESS_TIMEZONE)
        try:
            if self._print_kitchen:
                kitchen_bytes = render_kitchen_ticket(order, store_profile.trade_name)
                self._transport.send(kitchen_bytes)
            if self._print_customer:
                customer_bytes = render_customer_receipt(order, store_profile, fiscal_doc)
                self._transport.send(customer_bytes)

            return PosExportResult(
                adapter_name="ThermalPrinterAdapter",
                mechanism=PosMechanismType.THERMAL_PRINTER,
                success=True,
                destination="printer://spool",
                timestamp=now,
            )
        except Exception as exc:
            return PosExportResult(
                adapter_name="ThermalPrinterAdapter",
                mechanism=PosMechanismType.THERMAL_PRINTER,
                success=False,
                destination="printer://spool",
                timestamp=now,
                error_message=str(exc),
            )


class HttpSender(Protocol):
    def post(self, url: str, headers: dict[str, str], payload_bytes: bytes) -> tuple[int, str]: ...


class WebhookPosAdapter:
    def __init__(
        self,
        webhook_url: str,
        secret: str,
        sender: HttpSender,
        product_mapper: CatalogProductMapper | None = None,
    ) -> None:
        self._webhook_url = webhook_url
        self._secret = secret
        self._sender = sender
        self._mapper = product_mapper or CatalogProductMapper()

    def export_order(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None = None,
    ) -> PosExportResult:
        now = datetime.now(BUSINESS_TIMEZONE)
        try:
            data = {
                "event": "order.completed",
                "order_id": str(order.id),
                "store_slug": order.store_slug,
                "order_number": order.number,
                "timestamp": now.isoformat(),
                "total_cents": order.total_cents,
                "payment_method": order.payment_method.value,
                "dine_in": order.dine_in,
                "fiscal_key": fiscal_doc.access_key if fiscal_doc else None,
                "items": [
                    {
                        "product_id": item.product_id,
                        "sku": self._mapper.map_product(item.product_id).external_sku,
                        "plu": self._mapper.map_product(item.product_id).plu_code,
                        "name": item.name,
                        "quantity": item.quantity,
                        "unit_price_cents": item.unit_price_cents,
                    }
                    for item in order.items
                ],
            }
            body = json.dumps(data).encode("utf-8")
            signature = hmac.new(self._secret.encode(), body, hashlib.sha256).hexdigest()
            headers = {
                "Content-Type": "application/json",
                "X-TOPA-Signature": signature,
                "X-TOPA-Store": order.store_slug,
            }
            status_code, resp_text = self._sender.post(self._webhook_url, headers, body)
            if 200 <= status_code < 300:
                return PosExportResult(
                    adapter_name="WebhookAdapter",
                    mechanism=PosMechanismType.WEBHOOK,
                    success=True,
                    destination=self._webhook_url,
                    timestamp=now,
                )
            return PosExportResult(
                adapter_name="WebhookAdapter",
                mechanism=PosMechanismType.WEBHOOK,
                success=False,
                destination=self._webhook_url,
                timestamp=now,
                error_message=f"HTTP status {status_code}: {resp_text[:100]}",
            )
        except Exception as exc:
            return PosExportResult(
                adapter_name="WebhookAdapter",
                mechanism=PosMechanismType.WEBHOOK,
                success=False,
                destination=self._webhook_url,
                timestamp=now,
                error_message=str(exc),
            )


class CompositePosAdapter:
    def __init__(self, adapters: Sequence[PosAdapterPort]) -> None:
        self._adapters = tuple(adapters)

    def export_order(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None = None,
    ) -> list[PosExportResult]:
        return [
            adapter.export_order(order, store_profile, fiscal_doc) for adapter in self._adapters
        ]
