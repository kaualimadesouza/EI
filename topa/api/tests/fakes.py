"""In-memory implementations of the application ports, for use cases and HTTP tests."""

import uuid
from collections.abc import Collection
from dataclasses import dataclass, field, replace
from datetime import date, datetime

from topa_api.domain.catalog import Product
from topa_api.domain.errors import OrderNumberTakenError
from topa_api.domain.orders import Order, OrderStatus


@dataclass
class FixedClock:
    moment: datetime

    def now(self) -> datetime:
        return self.moment


@dataclass
class InMemoryProductRepository:
    products: list[Product]

    def list_all(self) -> list[Product]:
        return list(self.products)

    def find(self, product_ids: Collection[str]) -> list[Product]:
        return [product for product in self.products if product.id in product_ids]

    def set_availability(self, product_id: str, available: bool) -> Product | None:
        for position, product in enumerate(self.products):
            if product.id == product_id:
                self.products[position] = replace(product, available=available)
                return self.products[position]
        return None


@dataclass
class InMemoryOrderRepository:
    orders: list[Order] = field(default_factory=list)
    collisions: int = 0
    """How many of the next `add` calls lose the race: another kiosk stores that
    number first, so it is taken from then on."""
    numbers_taken_elsewhere: list[tuple[date, int]] = field(default_factory=list)

    def next_number(self, business_date: date) -> int:
        taken = [order.number for order in self.orders if order.business_date == business_date]
        taken += [number for day, number in self.numbers_taken_elsewhere if day == business_date]
        return max(taken, default=0) + 1

    def add(self, order: Order) -> None:
        if self.collisions > 0:
            self.collisions -= 1
            self.numbers_taken_elsewhere.append((order.business_date, order.number))
            raise OrderNumberTakenError
        self.orders.append(order)

    def list_for_day(self, business_date: date) -> list[Order]:
        return sorted(
            (order for order in self.orders if order.business_date == business_date),
            key=lambda order: order.number,
        )

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        return next((order for order in self.orders if order.id == order_id), None)

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None:
        self.orders = [
            replace(order, status=status) if order.id == order_id else order
            for order in self.orders
        ]
