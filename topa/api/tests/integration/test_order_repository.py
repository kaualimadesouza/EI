"""The order repository against real Postgres: the number race between two kiosks,
and the reads and locks behind the dashboard."""

import uuid
from datetime import UTC, date, datetime

import pytest
from psycopg.errors import LockNotAvailable
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError, OperationalError
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


def test_a_days_orders_come_by_number_and_only_from_that_day(db_engine: Engine) -> None:
    with Session(db_engine) as session, session.begin():
        orders = SqlAlchemyOrderRepository(session)
        second, first = _order(2), _order(1)
        orders.add(second)
        orders.add(_order(1, TUESDAY))
        orders.add(first)

    with Session(db_engine) as session:
        assert SqlAlchemyOrderRepository(session).list_for_day(MONDAY) == [first, second]


def test_an_order_read_for_update_is_held_until_that_transaction_ends(db_engine: Engine) -> None:
    """Otherwise two dashboards could each move the order from the same old status."""
    placed = _order(1)
    with Session(db_engine) as session, session.begin():
        SqlAlchemyOrderRepository(session).add(placed)

    with Session(db_engine) as first, first.begin():
        assert SqlAlchemyOrderRepository(first).get_for_update(placed.id) == placed
        with Session(db_engine) as second, pytest.raises(OperationalError) as raised:
            second.execute(
                select(OrderRow).where(OrderRow.id == placed.id).with_for_update(nowait=True)
            )

    assert isinstance(raised.value.orig, LockNotAvailable)
