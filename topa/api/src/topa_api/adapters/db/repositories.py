import uuid
from collections.abc import Collection
from datetime import date

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from topa_api.adapters.db.models import OrderItemRow, OrderRow, ProductRow
from topa_api.domain.catalog import Category, Product
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

# namespace of the per-day number lock, so it never meets another advisory lock
ORDER_NUMBER_LOCK = 1

# items in a second query, not a join: Postgres refuses FOR UPDATE on an outer join
WITH_ITEMS = selectinload(OrderRow.items).joinedload(OrderItemRow.product)


class SqlAlchemyProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> list[Product]:
        rows = self._session.scalars(select(ProductRow).order_by(ProductRow.position))
        return [_product_of(row) for row in rows]

    def find(self, product_ids: Collection[str]) -> list[Product]:
        rows = self._session.scalars(select(ProductRow).where(ProductRow.id.in_(product_ids)))
        return [_product_of(row) for row in rows]

    def set_availability(self, product_id: str, available: bool) -> Product | None:
        row = self._session.get(ProductRow, product_id)
        if row is None:
            return None
        row.available = available
        return _product_of(row)


class SqlAlchemyOrderRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def next_number(self, business_date: date) -> int:
        # held until the transaction ends: the next kiosk reads the max only after this commit
        self._session.execute(
            select(func.pg_advisory_xact_lock(ORDER_NUMBER_LOCK, business_date.toordinal()))
        )
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
        self._session.add(row)

    def list_for_day(self, business_date: date) -> list[Order]:
        rows = self._session.scalars(
            select(OrderRow)
            .where(OrderRow.business_date == business_date)
            .order_by(OrderRow.number)
            .options(WITH_ITEMS)
        )
        return [_order_of(row) for row in rows]

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        row = self._session.get(OrderRow, order_id, options=[WITH_ITEMS], with_for_update=True)
        return None if row is None else _order_of(row)

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None:
        self._session.execute(
            update(OrderRow).where(OrderRow.id == order_id).values(status=status.value)
        )


def _product_of(row: ProductRow) -> Product:
    return Product(
        id=row.id,
        name=row.name,
        description=row.description,
        category=Category(row.category),
        price_cents=row.price_cents,
        available=row.available,
    )


def _order_of(row: OrderRow) -> Order:
    return Order(
        id=row.id,
        number=row.number,
        business_date=row.business_date,
        status=OrderStatus(row.status),
        dine_in=row.dine_in,
        payment_method=PaymentMethod(row.payment_method),
        # menu order, the one the kitchen reads; the order the customer tapped is not stored
        items=tuple(
            OrderItem(
                product_id=item.product_id,
                name=item.product.name,
                quantity=item.quantity,
                unit_price_cents=item.unit_price_cents,
            )
            for item in sorted(row.items, key=lambda item: item.product.position)
        ),
        created_at=row.created_at,
    )
