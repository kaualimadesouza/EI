from collections.abc import Collection
from datetime import date, datetime
from typing import Protocol

from topa_api.domain.catalog import Product
from topa_api.domain.orders import Order


class ReadinessProbe(Protocol):
    """Whether the dependencies the API cannot serve without are answering."""

    def database_is_up(self) -> bool: ...


class Clock(Protocol):
    def now(self) -> datetime:
        """Timezone-aware; order numbers and the business day are read from it."""
        ...


class ProductRepository(Protocol):
    def list_all(self) -> list[Product]:
        """In menu order, sold-out products included."""
        ...

    def find(self, product_ids: Collection[str]) -> list[Product]:
        """The ones that exist, in no particular order; an unknown id is simply absent."""
        ...


class OrderRepository(Protocol):
    def next_number(self, business_date: date) -> int:
        """One past the highest number of that day, read inside the caller's transaction."""
        ...

    def add(self, order: Order) -> None:
        """Raises OrderNumberTakenError when another order stored that number first,
        leaving the transaction usable so the caller can ask for a new number."""
        ...
