"""In-memory implementations of the application ports, for use cases and HTTP tests."""

import uuid
from collections.abc import Collection
from dataclasses import dataclass, field, replace
from datetime import date, datetime

from topa_api.domain.catalog import Product, Store
from topa_api.domain.orders import Order, OrderStatus


@dataclass
class FixedClock:
    moment: datetime

    def now(self) -> datetime:
        return self.moment


@dataclass
class InMemoryStoreRepository:
    stores: list[Store]

    def get(self, slug: str) -> Store | None:
        return next((store for store in self.stores if store.slug == slug), None)


@dataclass
class InMemoryProductRepository:
    products_by_store: dict[str, list[Product]]

    def list_for_store(self, store_slug: str) -> list[Product]:
        return list(self.products_by_store.get(store_slug, ()))

    def find(self, store_slug: str, product_ids: Collection[str]) -> list[Product]:
        return [
            product
            for product in self.products_by_store.get(store_slug, ())
            if product.id in product_ids
        ]

    def set_availability(self, store_slug: str, product_id: str, available: bool) -> Product | None:
        catalog = self.products_by_store.get(store_slug, [])
        for position, product in enumerate(catalog):
            if product.id == product_id:
                catalog[position] = replace(product, available=available)
                return catalog[position]
        return None


@dataclass
class InMemoryOrderRepository:
    orders: list[Order] = field(default_factory=list)

    def next_number(self, store_slug: str, business_date: date) -> int:
        taken = [
            order.number
            for order in self.orders
            if order.store_slug == store_slug and order.business_date == business_date
        ]
        return max(taken, default=0) + 1

    def add(self, order: Order) -> None:
        self.orders.append(order)

    def list_for_day(self, store_slug: str, business_date: date) -> list[Order]:
        return sorted(
            (
                order
                for order in self.orders
                if order.store_slug == store_slug and order.business_date == business_date
            ),
            key=lambda order: order.number,
        )

    def get(self, order_id: uuid.UUID) -> Order | None:
        return next((order for order in self.orders if order.id == order_id), None)

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        return self.get(order_id)

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None:
        self.orders = [
            replace(order, status=status) if order.id == order_id else order
            for order in self.orders
        ]
