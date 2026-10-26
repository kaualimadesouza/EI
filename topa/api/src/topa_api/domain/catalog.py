from dataclasses import dataclass
from enum import StrEnum


class Category(StrEnum):
    COMBOS = "combos"
    LANCHES = "lanches"
    SALGADOS = "salgados"
    BEBIDAS = "bebidas"
    DOCES = "doces"


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    description: str
    category: Category
    price_cents: int
    available: bool
