import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from topa_api.domain.fiscal import (
    FiscalEnvironment,
    FiscalStandard,
    build_fiscal_document,
    calculate_mod11_check_digit,
    generate_access_key,
    generate_qr_code_url,
    get_store_fiscal_profile,
    resolve_item_fiscal_classification,
)
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

SP_TZ = ZoneInfo("America/Sao_Paulo")


def test_calculate_mod11_check_digit_standard() -> None:
    # 43 digits test key
    raw_key = "3526101234567800019565001000000001199999999"
    cdv = calculate_mod11_check_digit(raw_key)
    assert 0 <= cdv <= 9


def test_calculate_mod11_check_digit_zero_remainder() -> None:
    # Key crafted to test remainder < 2 branch
    # If remainder is 0 or 1, cdv must be 0
    raw_key = "0" * 43
    assert calculate_mod11_check_digit(raw_key) == 0


def test_generate_access_key() -> None:
    dt = datetime(2026, 10, 30, 15, 30, 0, tzinfo=SP_TZ)
    key = generate_access_key(
        uf_code="35",
        issued_at=dt,
        cnpj="12.345.678/0001-95",
        model="65",
        series=1,
        number=42,
    )
    assert len(key) == 44
    assert key.startswith("352610")
    assert "12345678000195" in key


def test_resolve_item_fiscal_classification() -> None:
    # Drinks
    ncm, cfop, csosn, rate = resolve_item_fiscal_classification("suco-laranja", "Suco de Laranja")
    assert ncm == "22021000"
    assert cfop == "5405"
    assert csosn == "500"
    assert rate == 0.25

    # Sweets
    ncm, cfop, csosn, rate = resolve_item_fiscal_classification("doce-leite", "Brigadeiro Gourmet")
    assert ncm == "17049090"
    assert cfop == "5102"
    assert csosn == "102"
    assert rate == 0.18

    # General food / snacks
    ncm, cfop, csosn, rate = resolve_item_fiscal_classification("misto-quente", "Misto Quente")
    assert ncm == "19059090"
    assert cfop == "5102"
    assert csosn == "102"
    assert rate == 0.15


def test_get_store_fiscal_profile_known_and_fallback() -> None:
    p1 = get_store_fiscal_profile("lanchonete-bem-te-vi")
    assert p1.cnpj == "12345678000195"
    assert p1.trade_name == "Bem-te-vi Lanches"

    p2 = get_store_fiscal_profile("pastelaria-do-parque")
    assert p2.cnpj == "23456789000101"

    p3 = get_store_fiscal_profile("hamburgueria-artesanal")
    assert p3.cnpj == "34567890000112"

    p_custom = get_store_fiscal_profile("cafe-central", store_name="Cafe Central")
    assert len(p_custom.cnpj) == 14
    assert p_custom.trade_name == "Cafe Central"
    assert p_custom.uf == "SP"

    p_custom_no_name = get_store_fiscal_profile("pizzaria-bela")
    assert p_custom_no_name.trade_name == "Pizzaria Bela"


def test_generate_qr_code_url() -> None:
    url = generate_qr_code_url(
        access_key="35261012345678000195650010000000011999999990",
        environment=FiscalEnvironment.HOMOLOGATION,
        csc_id="000001",
        csc_token="SECRET",
        uf="SP",
    )
    assert url.startswith("https://www.nfce.fazenda.sp.gov.br/qrcode?p=")
    assert "|2|2|000001|" in url


def test_build_fiscal_document_nfce() -> None:
    order = Order(
        id=uuid.uuid4(),
        store_slug="lanchonete-bem-te-vi",
        number=1,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        items=(
            OrderItem("misto", "Misto Quente", 2, 1200),
            OrderItem("suco", "Suco de Laranja", 1, 800),
        ),
        created_at=datetime(2026, 10, 30, 12, 0, 0, tzinfo=SP_TZ),
    )
    profile = get_store_fiscal_profile("lanchonete-bem-te-vi")
    doc = build_fiscal_document(
        order,
        profile,
        standard=FiscalStandard.NFCE,
        environment=FiscalEnvironment.HOMOLOGATION,
    )
    assert len(doc.access_key) == 44
    assert doc.standard == FiscalStandard.NFCE
    assert doc.total_cents == 3200
    assert doc.approx_tax_cents > 0
    assert "<NFe" in doc.xml_payload
    assert doc.json_payload["access_key"] == doc.access_key
    assert len(doc.formatted_access_key.split()) == 11


def test_build_fiscal_document_sat() -> None:
    order = Order(
        id=uuid.uuid4(),
        store_slug="pastelaria-do-parque",
        number=5,
        business_date=date(2026, 10, 30),
        status=OrderStatus.DELIVERED,
        dine_in=False,
        payment_method=PaymentMethod.PIX,
        items=(OrderItem("pastel", "Pastel de Carne", 1, 1000),),
        created_at=datetime(2026, 10, 30, 13, 0, 0, tzinfo=SP_TZ),
    )
    profile = get_store_fiscal_profile("pastelaria-do-parque")
    doc = build_fiscal_document(
        order,
        profile,
        standard=FiscalStandard.SAT,
        environment=FiscalEnvironment.PRODUCTION,
    )
    assert doc.standard == FiscalStandard.SAT
    assert doc.environment == FiscalEnvironment.PRODUCTION
    assert "<tPag>17</tPag>" in doc.xml_payload
