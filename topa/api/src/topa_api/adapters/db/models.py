import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from topa_api.adapters.db.base import Base
from topa_api.domain.catalog import DEFAULT_STORE_SLUG
from topa_api.domain.orders import OrderStatus, PaymentMethod
from topa_api.domain.payment import PaymentStatus


def _one_of(column: str, values: type[StrEnum]) -> CheckConstraint:
    allowed = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({allowed})", name=column)


class StoreRow(Base):
    __tablename__ = "stores"

    slug: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)


class ProductRow(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("store_slug", "position"),
        CheckConstraint("price_cents >= 0", name="price_cents"),
    )

    store_slug: Mapped[str] = mapped_column(
        Text,
        ForeignKey("stores.slug"),
        primary_key=True,
        server_default=DEFAULT_STORE_SLUG,
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    price_cents: Mapped[int] = mapped_column(Integer)
    available: Mapped[bool] = mapped_column(Boolean)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class OrderRow(Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("store_slug", "business_date", "number"),
        UniqueConstraint("id", "store_slug"),
        _one_of("status", OrderStatus),
        _one_of("payment_method", PaymentMethod),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    store_slug: Mapped[str] = mapped_column(
        Text, ForeignKey("stores.slug"), server_default=DEFAULT_STORE_SLUG
    )
    business_date: Mapped[date] = mapped_column(Date)
    number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text)
    dine_in: Mapped[bool] = mapped_column(Boolean)
    payment_method: Mapped[str] = mapped_column(Text)
    # what was charged, kept so the dashboard sums orders without re-pricing items
    total_cents: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True, unique=True, index=True
    )

    items: Mapped[list["OrderItemRow"]] = relationship(
        cascade="all, delete-orphan",
        primaryjoin=(
            "and_(OrderRow.id == OrderItemRow.order_id, "
            "OrderRow.store_slug == OrderItemRow.store_slug)"
        ),
    )


class OrderItemRow(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["order_id", "store_slug"],
            ["orders.id", "orders.store_slug"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["store_slug", "product_id"],
            ["products.store_slug", "products.id"],
        ),
        CheckConstraint("quantity >= 1", name="quantity"),
        CheckConstraint("unit_price_cents >= 0", name="unit_price_cents"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    store_slug: Mapped[str] = mapped_column(Text, server_default=DEFAULT_STORE_SLUG)
    product_id: Mapped[str] = mapped_column(Text, primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer)
    # a snapshot: the product's price may change, what this customer paid does not
    unit_price_cents: Mapped[int] = mapped_column(Integer)

    product: Mapped[ProductRow] = relationship(
        primaryjoin=(
            "and_(OrderItemRow.store_slug == ProductRow.store_slug, "
            "OrderItemRow.product_id == ProductRow.id)"
        ),
        viewonly=True,
    )


class MerchantRow(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    store_slug: Mapped[str] = mapped_column(Text, ForeignKey("stores.slug"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CustomerRow(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PaymentRow(Base):
    __tablename__ = "payments"
    __table_args__ = (_one_of("status", PaymentStatus),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    amount_cents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text)
    method: Mapped[str] = mapped_column(Text, server_default="pix")
    br_code: Mapped[str] = mapped_column(Text)
    br_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    qr_code_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
