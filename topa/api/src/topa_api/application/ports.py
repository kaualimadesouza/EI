import uuid
from collections.abc import Collection
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from topa_api.domain.auth import AuthenticatedMerchant, Merchant
from topa_api.domain.catalog import Product, Store
from topa_api.domain.orders import Order, OrderStatus


class ReadinessProbe(Protocol):
    """Whether the dependencies the API cannot serve without are answering."""

    def database_is_up(self) -> bool: ...


class Clock(Protocol):
    def now(self) -> datetime:
        """Timezone-aware; order numbers and the business day are read from it."""
        ...


class StoreRepository(Protocol):
    def get(self, slug: str) -> Store | None: ...


class ProductRepository(Protocol):
    def list_for_store(self, store_slug: str) -> list[Product]:
        """In menu order for that store, sold-out products included."""
        ...

    def find(self, store_slug: str, product_ids: Collection[str]) -> list[Product]:
        """That store's products matching those ids; an unknown id is absent."""
        ...

    def get(self, store_slug: str, product_id: str) -> Product | None:
        """A single product from that store, or None when absent."""
        ...

    def next_position(self, store_slug: str) -> int:
        """The next display position in that store's menu."""
        ...

    def create(self, store_slug: str, product: Product, position: int) -> Product:
        """Adds a new product to that store's menu."""
        ...

    def update(self, store_slug: str, product: Product) -> Product | None:
        """Updates product fields, or None when that store has no such product."""
        ...

    def set_availability(self, store_slug: str, product_id: str, available: bool) -> Product | None:
        """The product as it now stands, or None when that store has no such product."""
        ...


ProductRepositoryPort = ProductRepository
CatalogRepositoryPort = ProductRepository


class OrderRepository(Protocol):
    def next_number(self, store_slug: str, business_date: date) -> int:
        """One past the highest number of that store and day. Holds a per-store-day lock
        until the caller's transaction ends, so concurrent orders never share a number."""
        ...

    def add(self, order: Order) -> None: ...

    def list_for_day(self, store_slug: str, business_date: date) -> list[Order]:
        """That store's orders for the business day, by number."""
        ...

    def get(self, order_id: uuid.UUID) -> Order | None:
        """A plain read that holds nothing: the customer's phone asks every few seconds."""
        ...

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        """Holds the order until the transaction ends, so two dashboards moving it at once
        take turns instead of both checking the change against the same old status."""
        ...

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None: ...


@dataclass(frozen=True)
class MerchantRecord:
    merchant: Merchant
    password_hash: str


class MerchantRepositoryPort(Protocol):
    def get_by_email(self, email: str) -> MerchantRecord | None: ...

    def add(self, merchant: Merchant, password_hash: str) -> None: ...


MerchantRepository = MerchantRepositoryPort


class PasswordHasherPort(Protocol):
    def hash_password(self, password: str) -> str: ...

    def verify_password(self, plain_password: str, hashed_password: str) -> bool: ...


PasswordHasher = PasswordHasherPort


class TokenServicePort(Protocol):
    def create_token(
        self, merchant: AuthenticatedMerchant, expires_in_seconds: int = 86400
    ) -> str: ...

    def verify_token(self, token: str) -> AuthenticatedMerchant: ...


TokenService = TokenServicePort


class RateLimiterPort(Protocol):
    def check_rate_limit(self, key: str) -> None: ...


RateLimiter = RateLimiterPort
