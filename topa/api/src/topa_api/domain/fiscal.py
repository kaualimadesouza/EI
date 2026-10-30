import hashlib
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, StrEnum
from zoneinfo import ZoneInfo

from topa_api.domain.orders import Order, PaymentMethod

BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")


class FiscalStandard(StrEnum):
    NFCE = "nfce"
    SAT = "sat"


class FiscalEnvironment(int, Enum):
    PRODUCTION = 1
    HOMOLOGATION = 2


class TaxRegime(StrEnum):
    SIMPLES_NACIONAL = "1"
    REGIME_NORMAL = "3"


@dataclass(frozen=True)
class StoreFiscalProfile:
    store_slug: str
    cnpj: str
    corporate_name: str
    trade_name: str
    state_registration: str
    uf: str
    city_code: str
    street: str
    number: str
    district: str
    city: str
    postal_code: str
    tax_regime: TaxRegime = TaxRegime.SIMPLES_NACIONAL
    csc_id: str = "000001"
    csc_token: str = "1A2B3C4D5E6F7G8H9I0J"


STORE_FISCAL_PROFILES: dict[str, StoreFiscalProfile] = {
    "lanchonete-bem-te-vi": StoreFiscalProfile(
        store_slug="lanchonete-bem-te-vi",
        cnpj="12345678000195",
        corporate_name="Lanchonete Bem-te-vi Ltda",
        trade_name="Bem-te-vi Lanches",
        state_registration="123456789111",
        uf="SP",
        city_code="3550308",
        street="Av. Arlindo Bettio",
        number="1000",
        district="Ermelino Matarazzo",
        city="Sao Paulo",
        postal_code="03828000",
    ),
    "pastelaria-do-parque": StoreFiscalProfile(
        store_slug="pastelaria-do-parque",
        cnpj="23456789000101",
        corporate_name="Pastelaria do Parque Ltda",
        trade_name="Pastelaria do Parque",
        state_registration="234567890222",
        uf="SP",
        city_code="3550308",
        street="Rua do Parque",
        number="250",
        district="Parque Ecologico",
        city="Sao Paulo",
        postal_code="03828010",
    ),
    "hamburgueria-artesanal": StoreFiscalProfile(
        store_slug="hamburgueria-artesanal",
        cnpj="34567890000112",
        corporate_name="Hamburgueria Artesanal Eireli",
        trade_name="Hamburgueria Artesanal",
        state_registration="345678901333",
        uf="SP",
        city_code="3550308",
        street="Praca Central",
        number="42",
        district="Centro",
        city="Sao Paulo",
        postal_code="03828020",
    ),
}


def get_store_fiscal_profile(store_slug: str, store_name: str | None = None) -> StoreFiscalProfile:
    if store_slug in STORE_FISCAL_PROFILES:
        return STORE_FISCAL_PROFILES[store_slug]
    hashed = hashlib.sha256(store_slug.encode()).hexdigest()
    clean_digits = "".join(ch for ch in hashed if ch.isdigit())
    cnpj_base = (clean_digits[:12] + "01")[:14].ljust(14, "0")
    display = store_name or store_slug.replace("-", " ").title()
    return StoreFiscalProfile(
        store_slug=store_slug,
        cnpj=cnpj_base,
        corporate_name=f"{display} Ltda",
        trade_name=display,
        state_registration="100000000000",
        uf="SP",
        city_code="3550308",
        street="Rua Principal",
        number="100",
        district="Centro",
        city="Sao Paulo",
        postal_code="01001000",
    )


@dataclass(frozen=True)
class FiscalItemTax:
    product_id: str
    name: str
    quantity: int
    unit_price_cents: int
    total_price_cents: int
    ncm: str
    cfop: str
    csosn: str
    approx_tax_rate: float
    approx_tax_cents: int


@dataclass(frozen=True)
class FiscalDocument:
    access_key: str
    standard: FiscalStandard
    environment: FiscalEnvironment
    series: int
    number: int
    issued_at: datetime
    store_profile: StoreFiscalProfile
    items: tuple[FiscalItemTax, ...]
    subtotal_cents: int
    total_cents: int
    approx_tax_cents: int
    payment_method: PaymentMethod
    qr_code_url: str
    digest_value: str
    xml_payload: str
    json_payload: dict[str, object]

    @property
    def formatted_access_key(self) -> str:
        k = self.access_key
        return " ".join(k[i : i + 4] for i in range(0, len(k), 4))


def calculate_mod11_check_digit(key_43: str) -> int:
    weights = [2, 3, 4, 5, 6, 7, 8, 9]
    total = sum(int(digit) * weights[i % len(weights)] for i, digit in enumerate(reversed(key_43)))
    remainder = total % 11
    return 0 if remainder < 2 else 11 - remainder


def resolve_item_fiscal_classification(product_id: str, name: str) -> tuple[str, str, str, float]:
    lower_id = product_id.lower()
    lower_name = name.lower()
    if any(k in lower_id or k in lower_name for k in ("suco", "refri", "coca", "bebida", "agua")):
        return "22021000", "5405", "500", 0.25
    if any(k in lower_id or k in lower_name for k in ("brigadeiro", "brownie", "doce", "cookie")):
        return "17049090", "5102", "102", 0.18
    return "19059090", "5102", "102", 0.15


def generate_access_key(
    uf_code: str,
    issued_at: datetime,
    cnpj: str,
    model: str,
    series: int,
    number: int,
    emission_type: int = 1,
    numeric_code: int = 99999999,
) -> str:
    aamm = issued_at.strftime("%y%m")
    clean_cnpj = "".join(filter(str.isdigit, cnpj)).zfill(14)
    raw = (
        f"{uf_code[:2]:0>2}"
        f"{aamm}"
        f"{clean_cnpj}"
        f"{model[:2]:0>2}"
        f"{series:03d}"
        f"{number:09d}"
        f"{emission_type:01d}"
        f"{numeric_code:08d}"
    )
    cdv = calculate_mod11_check_digit(raw)
    return f"{raw}{cdv}"


def generate_qr_code_url(
    access_key: str,
    environment: FiscalEnvironment,
    csc_id: str,
    csc_token: str,
    uf: str = "SP",
) -> str:
    param_to_hash = f"{access_key}|2|{int(environment)}|{csc_id}{csc_token}"
    digest = hashlib.sha1(param_to_hash.encode()).hexdigest()
    base_url = "https://www.nfce.fazenda.sp.gov.br/qrcode"
    return f"{base_url}?p={access_key}|2|{int(environment)}|{csc_id}|{digest}"


def build_fiscal_document(
    order: Order,
    profile: StoreFiscalProfile,
    standard: FiscalStandard = FiscalStandard.NFCE,
    environment: FiscalEnvironment = FiscalEnvironment.HOMOLOGATION,
    series: int = 1,
) -> FiscalDocument:
    model_code = "65" if standard == FiscalStandard.NFCE else "59"
    uf_code = "35" if profile.uf == "SP" else "00"
    issued_at = order.created_at.astimezone(BUSINESS_TIMEZONE)
    key = generate_access_key(
        uf_code=uf_code,
        issued_at=issued_at,
        cnpj=profile.cnpj,
        model=model_code,
        series=series,
        number=order.number,
    )
    qr_url = generate_qr_code_url(
        access_key=key,
        environment=environment,
        csc_id=profile.csc_id,
        csc_token=profile.csc_token,
        uf=profile.uf,
    )

    fiscal_items: list[FiscalItemTax] = []
    total_tax_cents = 0
    for item in order.items:
        ncm, cfop, csosn, rate = resolve_item_fiscal_classification(item.product_id, item.name)
        line_total = item.quantity * item.unit_price_cents
        line_tax = round(line_total * rate)
        total_tax_cents += line_tax
        fiscal_items.append(
            FiscalItemTax(
                product_id=item.product_id,
                name=item.name,
                quantity=item.quantity,
                unit_price_cents=item.unit_price_cents,
                total_price_cents=line_total,
                ncm=ncm,
                cfop=cfop,
                csosn=csosn,
                approx_tax_rate=rate,
                approx_tax_cents=line_tax,
            )
        )

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">',
        f'  <infNFe Id="NFe{key}" versao="4.00">',
        "    <ide>",
        f"      <cUF>{uf_code}</cUF>",
        f"      <mod>{model_code}</mod>",
        f"      <serie>{series}</serie>",
        f"      <nNF>{order.number}</nNF>",
        f"      <dhEmi>{issued_at.isoformat()}</dhEmi>",
        f"      <tpAmb>{int(environment)}</tpAmb>",
        "    </ide>",
        "    <emit>",
        f"      <CNPJ>{profile.cnpj}</CNPJ>",
        f"      <xNome>{profile.corporate_name}</xNome>",
        f"      <xFant>{profile.trade_name}</xFant>",
        f"      <IE>{profile.state_registration}</IE>",
        f"      <CRT>{profile.tax_regime.value}</CRT>",
        "    </emit>",
    ]
    for idx, f_item in enumerate(fiscal_items, start=1):
        price_reais = f_item.unit_price_cents / 100.0
        total_reais = f_item.total_price_cents / 100.0
        xml_lines.extend(
            [
                f'    <det nItem="{idx}">',
                "      <prod>",
                f"        <cProd>{f_item.product_id}</cProd>",
                f"        <xProd>{f_item.name}</xProd>",
                f"        <NCM>{f_item.ncm}</NCM>",
                f"        <CFOP>{f_item.cfop}</CFOP>",
                "        <uCom>UN</uCom>",
                f"        <qCom>{f_item.quantity:.4f}</qCom>",
                f"        <vUnCom>{price_reais:.2f}</vUnCom>",
                f"        <vProd>{total_reais:.2f}</vProd>",
                "      </prod>",
                "      <imposto>",
                f"        <vTotTrib>{(f_item.approx_tax_cents / 100.0):.2f}</vTotTrib>",
                "        <ICMS>",
                f"          <ICMSSN{f_item.csosn}>",
                "            <orig>0</orig>",
                f"            <CSOSN>{f_item.csosn}</CSOSN>",
                f"          </ICMSSN{f_item.csosn}>",
                "        </ICMS>",
                "      </imposto>",
                "    </det>",
            ]
        )

    order_total_reais = order.total_cents / 100.0
    tax_total_reais = total_tax_cents / 100.0
    xml_lines.extend(
        [
            "    <total>",
            "      <ICMSTot>",
            f"        <vProd>{order_total_reais:.2f}</vProd>",
            f"        <vNF>{order_total_reais:.2f}</vNF>",
            f"        <vTotTrib>{tax_total_reais:.2f}</vTotTrib>",
            "      </ICMSTot>",
            "    </total>",
            "    <pag>",
            "      <detPag>",
            f"        <tPag>{'03' if order.payment_method == PaymentMethod.CARD else '17'}</tPag>",
            f"        <vPag>{order_total_reais:.2f}</vPag>",
            "      </detPag>",
            "    </pag>",
            "    <infRespTec>",
            "      <CNPJ>99999999000199</CNPJ>",
            "      <xContato>TOPA Integracao</xContato>",
            "    </infRespTec>",
            "  </infNFe>",
            "</NFe>",
        ]
    )
    xml_content = "\n".join(xml_lines)
    digest = hashlib.sha1(xml_content.encode()).hexdigest()

    json_payload: dict[str, object] = {
        "access_key": key,
        "standard": standard.value,
        "environment": int(environment),
        "series": series,
        "number": order.number,
        "issued_at": issued_at.isoformat(),
        "store": {
            "slug": profile.store_slug,
            "cnpj": profile.cnpj,
            "corporate_name": profile.corporate_name,
            "trade_name": profile.trade_name,
            "ie": profile.state_registration,
            "uf": profile.uf,
        },
        "totals": {
            "subtotal_cents": order.total_cents,
            "total_cents": order.total_cents,
            "approx_tax_cents": total_tax_cents,
        },
        "payment": {
            "method": order.payment_method.value,
            "amount_cents": order.total_cents,
        },
        "items": [
            {
                "product_id": it.product_id,
                "name": it.name,
                "quantity": it.quantity,
                "unit_price_cents": it.unit_price_cents,
                "total_price_cents": it.total_price_cents,
                "ncm": it.ncm,
                "cfop": it.cfop,
                "csosn": it.csosn,
                "approx_tax_cents": it.approx_tax_cents,
            }
            for it in fiscal_items
        ],
        "qr_code_url": qr_url,
        "digest": digest,
    }

    return FiscalDocument(
        access_key=key,
        standard=standard,
        environment=environment,
        series=series,
        number=order.number,
        issued_at=issued_at,
        store_profile=profile,
        items=tuple(fiscal_items),
        subtotal_cents=order.total_cents,
        total_cents=order.total_cents,
        approx_tax_cents=total_tax_cents,
        payment_method=order.payment_method,
        qr_code_url=qr_url,
        digest_value=digest,
        xml_payload=xml_content,
        json_payload=json_payload,
    )
