"""The order repository against real Postgres: the number race between kiosks,
and the reads and locks behind the dashboard."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from threading import Barrier

import pytest
from psycopg.errors import LockNotAvailable
from sqlalchemy import Engine, insert, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from topa_api.adapters.db.models import OrderRow, ProductRow, StoreRow
from topa_api.adapters.db.repositories import SqlAlchemyOrderRepository
from topa_api.domain.catalog import DEFAULT_STORE_SLUG
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

MONDAY = date(2026, 10, 26)
TUESDAY = date(2026, 10, 27)


def _order(
    number: int,
    business_date: date = MONDAY,
    product_id: str = "cafe",
    store_slug: str = DEFAULT_STORE_SLUG,
) -> Order:
    return Order(
        id=uuid.uuid4(),
        store_slug=store_slug,
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


def _numbers(
    db_engine: Engine, business_date: date, store_slug: str = DEFAULT_STORE_SLUG
) -> list[int]:
    with Session(db_engine) as session:
        return list(
            session.scalars(
                select(OrderRow.number)
                .where(
                    OrderRow.store_slug == store_slug,
                    OrderRow.business_date == business_date,
                )
                .order_by(OrderRow.number)
            )
        )


def test_the_first_order_of_a_day_is_number_one(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        assert SqlAlchemyOrderRepository(session).next_number(DEFAULT_STORE_SLUG, MONDAY) == 1


def test_the_next_number_follows_the_highest_of_that_store_and_day_only(
    db_engine: Engine,
) -> None:
    with db_engine.begin() as connection:
        connection.execute(insert(StoreRow).values(slug="cantina-central", name="Cantina Central"))
        connection.execute(
            insert(ProductRow).values(
                store_slug="cantina-central",
                id="cafe",
                position=1,
                name="Café coado",
                description="150 ml.",
                category="bebidas",
                price_cents=550,
                available=True,
            )
        )

    with Session(db_engine) as session, session.begin():
        orders = SqlAlchemyOrderRepository(session)
        orders.add(_order(1))
        orders.add(_order(2))
        orders.add(_order(1, store_slug="cantina-central"))

        assert orders.next_number(DEFAULT_STORE_SLUG, MONDAY) == 3
        assert orders.next_number("cantina-central", MONDAY) == 2
        assert orders.next_number(DEFAULT_STORE_SLUG, TUESDAY) == 1


def test_simultaneous_orders_of_one_day_all_get_their_own_number(db_engine: Engine) -> None:
    """Two kiosks reading the same max must not both pick it: the lock serialises them."""
    kiosks = 10  # under the pool size: each waits at the barrier holding a connection
    barrier = Barrier(kiosks)

    def place_one(_: int) -> int:
        with Session(db_engine) as session, session.begin():
            orders = SqlAlchemyOrderRepository(session)
            session.connection()  # open the transaction now, connections are lazy
            barrier.wait(timeout=10)
            number = orders.next_number(DEFAULT_STORE_SLUG, MONDAY)
            orders.add(_order(number))
            return number

    with ThreadPoolExecutor(max_workers=kiosks) as pool:
        got = list(pool.map(place_one, range(kiosks)))

    assert sorted(got) == list(range(1, kiosks + 1))
    assert _numbers(db_engine, MONDAY) == list(range(1, kiosks + 1))


def test_a_days_orders_come_by_number_and_only_from_that_store_and_day(
    db_engine: Engine,
) -> None:
    with db_engine.begin() as connection:
        connection.execute(insert(StoreRow).values(slug="cantina-central", name="Cantina Central"))
        connection.execute(
            insert(ProductRow).values(
                store_slug="cantina-central",
                id="cafe",
                position=1,
                name="Café coado",
                description="150 ml.",
                category="bebidas",
                price_cents=550,
                available=True,
            )
        )

    with Session(db_engine) as session, session.begin():
        orders = SqlAlchemyOrderRepository(session)
        second, first = _order(2), _order(1)
        orders.add(second)
        orders.add(_order(1, TUESDAY))
        orders.add(_order(1, MONDAY, store_slug="cantina-central"))
        orders.add(first)

    with Session(db_engine) as session:
        assert SqlAlchemyOrderRepository(session).list_for_day(DEFAULT_STORE_SLUG, MONDAY) == [
            first,
            second,
        ]


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


def test_a_plain_read_of_an_order_holds_nothing(db_engine: Engine) -> None:
    """The customer's phone reads its order every few seconds; the dashboard must never wait."""
    placed = _order(1)
    with Session(db_engine) as session, session.begin():
        SqlAlchemyOrderRepository(session).add(placed)

    with Session(db_engine) as first, first.begin():
        assert SqlAlchemyOrderRepository(first).get(placed.id) == placed
        assert SqlAlchemyOrderRepository(first).get(uuid.uuid4()) is None
        with Session(db_engine) as second, second.begin():
            locked = second.execute(
                select(OrderRow.id).where(OrderRow.id == placed.id).with_for_update(nowait=True)
            )
            assert locked.scalar_one() == placed.id
