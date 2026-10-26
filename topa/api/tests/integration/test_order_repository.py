"""The order number race, against real Postgres: two kiosks read the same max."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from topa_api.adapters.db.models import OrderRow
from topa_api.adapters.db.repositories import SqlAlchemyOrderRepository
from topa_api.domain.errors import OrderNumberTakenError
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

MONDAY = date(2026, 10, 26)
TUESDAY = date(2026, 10, 27)


def _order(number: int, business_date: date = MONDAY, product_id: str = "cafe") -> Order:
    return Order(
        id=uuid.uuid4(),
        number=number,
        business_date=business_date,
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(
            OrderItem(product_id=product_id, name="Café coado", quantity=1, unit_price_cents=550),
        ),
        created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
    )


def _numbers(db_engine: Engine, business_date: date) -> list[int]:
    with Session(db_engine) as session:
        return list(
            session.scalars(
                select(OrderRow.number)
                .where(OrderRow.business_date == business_date)
                .order_by(OrderRow.number)
            )
        )


def test_the_first_order_of_a_day_is_number_one(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        assert SqlAlchemyOrderRepository(session).next_number(MONDAY) == 1


def test_the_next_number_follows_the_highest_of_that_day_only(db_engine: Engine) -> None:
    with Session(db_engine) as session, session.begin():
        orders = SqlAlchemyOrderRepository(session)
        orders.add(_order(1))
        orders.add(_order(2))

        assert orders.next_number(MONDAY) == 3
        assert orders.next_number(TUESDAY) == 1


def test_a_number_taken_by_another_kiosk_is_reported_and_the_transaction_survives(
    db_engine: Engine,
) -> None:
    with Session(db_engine) as late, late.begin():
        late_orders = SqlAlchemyOrderRepository(late)
        stale_number = late_orders.next_number(MONDAY)
        with Session(db_engine) as early, early.begin():
            SqlAlchemyOrderRepository(early).add(_order(stale_number))

        with pytest.raises(OrderNumberTakenError):
            late_orders.add(_order(stale_number))
        late_orders.add(_order(late_orders.next_number(MONDAY)))

    assert _numbers(db_engine, MONDAY) == [1, 2]


def test_any_other_integrity_error_is_not_mistaken_for_a_taken_number(db_engine: Engine) -> None:
    """A product that vanished mid-order is a bug to surface, not a race to retry."""
    with Session(db_engine) as session, session.begin(), pytest.raises(IntegrityError):
        SqlAlchemyOrderRepository(session).add(_order(1, product_id="pastel"))
