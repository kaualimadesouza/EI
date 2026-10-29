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


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    description: str
    category: Category
    price_cents: int
    available: bool


@dataclass(frozen=True)
class StoreMenu:
    store: Store
    products: tuple[Product, ...]
