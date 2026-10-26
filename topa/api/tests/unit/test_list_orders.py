import uuid
from datetime import UTC, date, datetime

import pytest

from tests.fakes import FixedClock, InMemoryOrderRepository
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

MONDAY = date(2026, 10, 26)
TUESDAY = date(2026, 10, 27)


def _order(number: int, business_date: date) -> Order:
    return Order(
        id=uuid.uuid4(),
        number=number,
        business_date=business_date,
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(OrderItem(product_id="cafe", name="Café coado", quantity=1, unit_price_cents=550),),
        created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
    )


@pytest.fixture
def orders() -> InMemoryOrderRepository:
    return InMemoryOrderRepository(
        orders=[_order(2, MONDAY), _order(1, TUESDAY), _order(1, MONDAY)]
    )


def test_lists_the_day_asked_for_by_number(orders: InMemoryOrderRepository) -> None:
    clock = FixedClock(datetime(2026, 10, 27, 15, 0, tzinfo=UTC))

    listed = ListOrdersUseCase(orders, clock).execute(MONDAY)

    assert [(order.business_date, order.number) for order in listed] == [(MONDAY, 1), (MONDAY, 2)]


def test_without_a_day_lists_today_in_sao_paulo(orders: InMemoryOrderRepository) -> None:
    clock = FixedClock(datetime(2026, 10, 27, 15, 0, tzinfo=UTC))

    listed = ListOrdersUseCase(orders, clock).execute(None)

    assert [(order.business_date, order.number) for order in listed] == [(TUESDAY, 1)]


def test_late_at_night_today_is_still_that_evenings_shift(
    orders: InMemoryOrderRepository,
) -> None:
    """2h30 UTC on Tuesday is 23h30 on Monday in São Paulo."""
    clock = FixedClock(datetime(2026, 10, 27, 2, 30, tzinfo=UTC))

    listed = ListOrdersUseCase(orders, clock).execute(None)

    assert [(order.business_date, order.number) for order in listed] == [(MONDAY, 1), (MONDAY, 2)]
