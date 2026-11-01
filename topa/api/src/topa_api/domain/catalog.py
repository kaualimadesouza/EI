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


STORE_METADATA: dict[str, dict[str, object]] = {
    "lanchonete-bem-te-vi": {
        "latitude": -23.4823,
        "longitude": -46.5012,
        "address": "Praça Central - Bloco A",
        "category": "Lanches Tradicionais",
    },
    "brasa-burgers": {
        "latitude": -23.4828,
        "longitude": -46.5005,
        "address": "Praça de Alimentação - Quiosque 4",
        "category": "Burgers & Grill",
    },
    "bella-nonna": {
        "latitude": -23.4815,
        "longitude": -46.5020,
        "address": "Boulevard Acadêmico - Bloco B",
        "category": "Culinária Italiana",
    },
    "acai-bowls": {
        "latitude": -23.4835,
        "longitude": -46.4998,
        "address": "Centro de Convivência Esportiva",
        "category": "Saudável & Bowls",
    },
}


def build_store(slug: str, name: str) -> Store:
    """Enriches store with known campus coordinates and category."""
    meta = STORE_METADATA.get(slug, {})
    lat = meta.get("latitude")
    lng = meta.get("longitude")
    addr = meta.get("address")
    cat = meta.get("category")
    return Store(
        slug=slug,
        name=name,
        latitude=float(lat) if isinstance(lat, (int, float)) else None,
        longitude=float(lng) if isinstance(lng, (int, float)) else None,
        address=str(addr) if isinstance(addr, str) else None,
        category=str(cat) if isinstance(cat, str) else None,
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
