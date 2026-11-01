from dataclasses import dataclass
from enum import StrEnum

DEFAULT_STORE_SLUG = "lanchonete-bem-te-vi"
STORE_SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
STORE_SLUG_MAX_LENGTH = 64


class Category(StrEnum):
    COMBOS = "combos"
    LANCHES = "lanches"
    SALGADOS = "salgados"
    BEBIDAS = "bebidas"
    DOCES = "doces"


@dataclass(frozen=True)
class Store:
    slug: str
    name: str
    latitude: float | None = None
    longitude: float | None = None
    address: str | None = None
    category: str | None = None
    segment: str = "restaurant"


STORE_METADATA: dict[str, dict[str, object]] = {
    "lanchonete-bem-te-vi": {
        "latitude": -23.4823,
        "longitude": -46.5012,
        "address": "Praça Central - Bloco A",
        "category": "Lanches Tradicionais",
        "segment": "restaurant",
    },
    "brasa-burgers": {
        "latitude": -23.4828,
        "longitude": -46.5005,
        "address": "Praça de Alimentação - Quiosque 4",
        "category": "Burgers & Grill",
        "segment": "restaurant",
    },
    "bella-nonna": {
        "latitude": -23.4815,
        "longitude": -46.5020,
        "address": "Boulevard Acadêmico - Bloco B",
        "category": "Culinária Italiana",
        "segment": "restaurant",
    },
    "acai-bowls": {
        "latitude": -23.4835,
        "longitude": -46.4998,
        "address": "Centro de Convivência Esportiva",
        "category": "Saudável & Bowls",
        "segment": "restaurant",
    },
    "emporio-campus": {
        "latitude": -23.4820,
        "longitude": -46.5008,
        "address": "Vivência Central - Bloco C",
        "category": "Mercado Express",
        "segment": "market",
    },
    "conveniencia-central": {
        "latitude": -23.4830,
        "longitude": -46.5018,
        "address": "Acesso Portaria Principal",
        "category": "Conveniência & Bebidas",
        "segment": "market",
    },
}


def build_store(slug: str, name: str) -> Store:
    """Enriches store with known campus coordinates and category."""
    meta = STORE_METADATA.get(slug, {})
    lat = meta.get("latitude")
    lng = meta.get("longitude")
    addr = meta.get("address")
    cat = meta.get("category")
    segment = meta.get("segment", "restaurant")
    return Store(
        slug=slug,
        name=name,
        latitude=float(lat) if isinstance(lat, (int, float)) else None,
        longitude=float(lng) if isinstance(lng, (int, float)) else None,
        address=str(addr) if isinstance(addr, str) else None,
        category=str(cat) if isinstance(cat, str) else None,
        segment=str(segment),
    )


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    description: str
    category: str
    price_cents: int
    available: bool
    photo_url: str | None = None


@dataclass(frozen=True)
class StoreMenu:
    store: Store
    products: tuple[Product, ...]
