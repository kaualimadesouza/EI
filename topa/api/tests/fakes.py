"""In-memory implementations of the application ports, for use cases and HTTP tests."""

import uuid
from collections.abc import Collection
from dataclasses import dataclass, field, replace
from datetime import date, datetime

from topa_api.application.ports import CustomerRecord, MerchantRecord
from topa_api.domain.auth import (
    AuthenticatedCustomer,
    AuthenticatedMerchant,
    Customer,
    Merchant,
)
from topa_api.domain.catalog import Product, Store
from topa_api.domain.errors import InvalidTokenError, RateLimitExceededError
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

    def list_all(self) -> list[Store]:
        return list(self.stores)


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

    def get(self, store_slug: str, product_id: str) -> Product | None:
        return next(
            (p for p in self.products_by_store.get(store_slug, ()) if p.id == product_id), None
        )

    def next_position(self, store_slug: str) -> int:
        return len(self.products_by_store.get(store_slug, ())) + 1

    def create(self, store_slug: str, product: Product, position: int) -> Product:
        if store_slug not in self.products_by_store:
            self.products_by_store[store_slug] = []
        self.products_by_store[store_slug].append(product)
        return product

    def update(self, store_slug: str, product: Product) -> Product | None:
        catalog = self.products_by_store.get(store_slug, [])
        for pos, existing in enumerate(catalog):
            if existing.id == product.id:
                catalog[pos] = product
                return product
        return None

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

    def list_for_customer(self, customer_id: uuid.UUID) -> list[Order]:
        return [order for order in self.orders if order.customer_id == customer_id]


@dataclass
class FakeMerchantRepository:
    merchants: list[Merchant] = field(default_factory=list)
    password_hashes: dict[str, str] = field(default_factory=dict)

    def get_by_email(self, email: str) -> MerchantRecord | None:
        lowered = email.lower().strip()
        merchant = next((m for m in self.merchants if m.email.lower() == lowered), None)
        if merchant is None:
            return None
        return MerchantRecord(
            merchant=merchant,
            password_hash=self.password_hashes.get(lowered, ""),
        )

    def add(self, merchant: Merchant, password_hash: str) -> None:
        self.merchants.append(merchant)
        self.password_hashes[merchant.email.lower().strip()] = password_hash


class FakePasswordHasher:
    def hash_password(self, password: str) -> str:
        return f"hashed_{password}"

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return hashed_password == f"hashed_{plain_password}"


@dataclass
class FakeTokenService:
    valid_tokens: dict[str, AuthenticatedMerchant] = field(default_factory=dict)
    valid_customer_tokens: dict[str, AuthenticatedCustomer] = field(default_factory=dict)

    def create_token(self, merchant: AuthenticatedMerchant, expires_in_seconds: int = 86400) -> str:
        token = f"token_for_{merchant.id}"
        self.valid_tokens[token] = merchant
        return token

    def verify_token(self, token: str) -> AuthenticatedMerchant:
        if token not in self.valid_tokens:
            raise InvalidTokenError()
        return self.valid_tokens[token]

    def create_customer_token(
        self, customer: AuthenticatedCustomer, expires_in_seconds: int = 86400
    ) -> str:
        token = f"token_for_customer_{customer.id}"
        self.valid_customer_tokens[token] = customer
        return token

    def verify_customer_token(self, token: str) -> AuthenticatedCustomer:
        if token not in self.valid_customer_tokens:
            raise InvalidTokenError()
        return self.valid_customer_tokens[token]


@dataclass
class FakeCustomerRepository:
    customers: list[Customer] = field(default_factory=list)
    password_hashes: dict[str, str] = field(default_factory=dict)

    def get_by_email(self, email: str) -> CustomerRecord | None:
        lowered = email.lower().strip()
        customer = next((c for c in self.customers if c.email.lower() == lowered), None)
        if customer is None:
            return None
        return CustomerRecord(
            customer=customer,
            password_hash=self.password_hashes.get(lowered, ""),
        )

    def get_by_id(self, customer_id: uuid.UUID) -> CustomerRecord | None:
        customer = next((c for c in self.customers if c.id == customer_id), None)
        if customer is None:
            return None
        return CustomerRecord(
            customer=customer,
            password_hash=self.password_hashes.get(customer.email.lower().strip(), ""),
        )

    def add(self, customer: Customer, password_hash: str) -> None:
        self.customers.append(customer)
        self.password_hashes[customer.email.lower().strip()] = password_hash


@dataclass
class FakeRateLimiter:
    limit: int = 10
    retry_after: int = 60
    calls: dict[str, int] = field(default_factory=dict)

    def check_rate_limit(self, key: str) -> None:
        current = self.calls.get(key, 0)
        if current >= self.limit:
            raise RateLimitExceededError(self.retry_after)
        self.calls[key] = current + 1
