import uuid
from collections.abc import Collection
from datetime import date, datetime
from typing import Protocol

from topa_api.domain.catalog import Product
from topa_api.domain.orders import Order, OrderStatus


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

    def set_availability(self, product_id: str, available: bool) -> Product | None:
        """The product as it now stands, or None when no product has that id."""
        ...


class OrderRepository(Protocol):
    def next_number(self, business_date: date) -> int:
        """One past the highest number of that day. Holds a per-day lock until the
        caller's transaction ends, so concurrent orders never share a number."""
        ...

    def add(self, order: Order) -> None: ...

    def list_for_day(self, business_date: date) -> list[Order]:
        """That business day's orders, by number."""
        ...

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        """Holds the order until the transaction ends, so two dashboards moving it at once
        take turns instead of both checking the change against the same old status."""
        ...

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None: ...
