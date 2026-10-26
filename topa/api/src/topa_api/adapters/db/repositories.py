from collections.abc import Collection
from datetime import date

from psycopg.errors import UniqueViolation
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from topa_api.adapters.db.models import OrderItemRow, OrderRow, ProductRow
from topa_api.domain.catalog import Category, Product
from topa_api.domain.errors import OrderNumberTakenError
from topa_api.domain.orders import Order

ORDER_NUMBER_CONSTRAINT = "uq_orders_business_date_number"


class SqlAlchemyProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> list[Product]:
        rows = self._session.scalars(select(ProductRow).order_by(ProductRow.position))
        return [_product_of(row) for row in rows]

    def find(self, product_ids: Collection[str]) -> list[Product]:
        rows = self._session.scalars(select(ProductRow).where(ProductRow.id.in_(product_ids)))
        return [_product_of(row) for row in rows]


class SqlAlchemyOrderRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def next_number(self, business_date: date) -> int:
        highest = self._session.scalar(
            select(func.max(OrderRow.number)).where(OrderRow.business_date == business_date)
        )
        return (highest or 0) + 1

    def add(self, order: Order) -> None:
        row = OrderRow(
            id=order.id,
            business_date=order.business_date,
            number=order.number,
            status=order.status.value,
            dine_in=order.dine_in,
            payment_method=order.payment_method.value,
            total_cents=order.total_cents,
            created_at=order.created_at,
            items=[
                OrderItemRow(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price_cents=item.unit_price_cents,
                )
                for item in order.items
            ],
        )
        try:
            # a savepoint: a failed INSERT aborts the whole Postgres transaction otherwise
            with self._session.begin_nested():
                self._session.add(row)
        except IntegrityError as error:
            if not _violates(error, ORDER_NUMBER_CONSTRAINT):
                raise
            raise OrderNumberTakenError from error


def _violates(error: IntegrityError, constraint: str) -> bool:
    cause = error.orig
    return isinstance(cause, UniqueViolation) and cause.diag.constraint_name == constraint


def _product_of(row: ProductRow) -> Product:
    return Product(
        id=row.id,
        name=row.name,
        description=row.description,
        category=Category(row.category),
        price_cents=row.price_cents,
        available=row.available,
    )
