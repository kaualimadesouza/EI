import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from topa_api.adapters.db.base import Base
from topa_api.domain.catalog import Category
from topa_api.domain.orders import OrderStatus, PaymentMethod


def _one_of(column: str, values: type[StrEnum]) -> CheckConstraint:
    allowed = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({allowed})", name=column)


class ProductRow(Base):
    __tablename__ = "products"
    __table_args__ = (
        _one_of("category", Category),
        CheckConstraint("price_cents >= 0", name="price_cents"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    price_cents: Mapped[int] = mapped_column(Integer)
    available: Mapped[bool] = mapped_column(Boolean)


class OrderRow(Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("business_date", "number"),
        _one_of("status", OrderStatus),
        _one_of("payment_method", PaymentMethod),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    business_date: Mapped[date] = mapped_column(Date)
    number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text)
    dine_in: Mapped[bool] = mapped_column(Boolean)
    payment_method: Mapped[str] = mapped_column(Text)
    # what was charged, kept so the dashboard sums orders without re-pricing items
    total_cents: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    items: Mapped[list["OrderItemRow"]] = relationship(cascade="all, delete-orphan")


class OrderItemRow(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="quantity"),
        CheckConstraint("unit_price_cents >= 0", name="unit_price_cents"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("orders.id", ondelete="CASCADE"), primary_key=True
    )
    product_id: Mapped[str] = mapped_column(Text, ForeignKey("products.id"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer)
    # a snapshot: the product's price may change, what this customer paid does not
    unit_price_cents: Mapped[int] = mapped_column(Integer)
