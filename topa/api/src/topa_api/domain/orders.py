import uuid
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime
from enum import StrEnum
from typing import Self
from zoneinfo import ZoneInfo

from topa_api.domain.catalog import Product
from topa_api.domain.errors import (
    EmptyOrderError,
    ProductUnavailableError,
    QuantityOutOfRangeError,
    StatusChangeNotAllowedError,
    UnknownProductError,
)

MIN_QUANTITY = 1
MAX_QUANTITY = 20

# order numbers restart every day the shop opens, and the shop lives in this zone
BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")


class OrderStatus(StrEnum):
    """Declared in the order an order walks through them, from the kiosk to the counter."""

    RECEIVED = "received"
    PREPARING = "preparing"
    READY = "ready"
    DELIVERED = "delivered"


# how the lojista reads each status; the wire keeps the English values
STATUS_LABELS = {
    OrderStatus.RECEIVED: "recebido",
    OrderStatus.PREPARING: "em preparo",
    OrderStatus.READY: "pronto",
    OrderStatus.DELIVERED: "entregue",
}

LIFECYCLE = tuple(OrderStatus)


class PaymentMethod(StrEnum):
    CARD = "card"
    PIX = "pix"


@dataclass(frozen=True)
class OrderLine:
    """What the customer asked for: a product and how many, no price."""

    product_id: str
    quantity: int

    def __post_init__(self) -> None:
        if not MIN_QUANTITY <= self.quantity <= MAX_QUANTITY:
            raise QuantityOutOfRangeError(MIN_QUANTITY, MAX_QUANTITY)


@dataclass(frozen=True)
class OrderItem:
    """A line priced from the catalog when the order was placed."""

    product_id: str
    name: str
    quantity: int
    unit_price_cents: int


@dataclass(frozen=True)
class Order:
    id: uuid.UUID
    store_slug: str
    number: int
    business_date: date
    status: OrderStatus
    dine_in: bool
    payment_method: PaymentMethod
    items: tuple[OrderItem, ...]
    created_at: datetime

    @property
    def total_cents(self) -> int:
        return sum(item.quantity * item.unit_price_cents for item in self.items)

    def moved_to(self, status: OrderStatus) -> Self:
        """One step forward, or one back so a misplaced card on the dashboard can be undone."""
        if abs(LIFECYCLE.index(status) - LIFECYCLE.index(self.status)) != 1:
            raise StatusChangeNotAllowedError(
                self.number, STATUS_LABELS[self.status], STATUS_LABELS[status]
            )
        return replace(self, status=status)


def merge_lines(lines: Sequence[OrderLine]) -> tuple[OrderLine, ...]:
    """One line per product; the quantity cap applies to the sum, not to each repeat."""
    if not lines:
        raise EmptyOrderError
    quantities: dict[str, int] = {}
    for line in lines:
        quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity
    return tuple(
        OrderLine(product_id=product_id, quantity=quantity)
        for product_id, quantity in quantities.items()
    )


def price_lines(lines: Sequence[OrderLine], products: Sequence[Product]) -> tuple[OrderItem, ...]:
    """Prices come from the catalog only: whatever the kiosk believed is ignored."""
    catalog = {product.id: product for product in products}
    items = []
    for line in lines:
        product = catalog.get(line.product_id)
        if product is None:
            raise UnknownProductError(line.product_id)
        if not product.available:
            raise ProductUnavailableError(product.name)
        items.append(
            OrderItem(
                product_id=product.id,
                name=product.name,
                quantity=line.quantity,
                unit_price_cents=product.price_cents,
            )
        )
    return tuple(items)


def business_date_of(moment: datetime) -> date:
    return moment.astimezone(BUSINESS_TIMEZONE).date()
