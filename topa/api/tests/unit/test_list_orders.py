import uuid
from datetime import UTC, date, datetime

import pytest

from tests.fakes import FixedClock, InMemoryOrderRepository, InMemoryStoreRepository
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.domain.catalog import Store
from topa_api.domain.errors import StoreNotFoundError
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

MONDAY = date(2026, 10, 26)
TUESDAY = date(2026, 10, 27)
BEM_TE_VI = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
CANTINA = Store(slug="cantina-central", name="Cantina Central")


def _order(number: int, business_date: date, store_slug: str = BEM_TE_VI.slug) -> Order:
    return Order(
        id=uuid.uuid4(),
        store_slug=store_slug,
        number=number,
        business_date=business_date,
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(OrderItem(product_id="cafe", name="Café coado", quantity=1, unit_price_cents=550),),
        created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
    )


@pytest.fixture
def stores() -> InMemoryStoreRepository:
    return InMemoryStoreRepository([BEM_TE_VI, CANTINA])


@pytest.fixture
def orders() -> InMemoryOrderRepository:
    return InMemoryOrderRepository(
        orders=[
            _order(2, MONDAY),
            _order(1, TUESDAY),
            _order(1, MONDAY),
            _order(1, MONDAY, CANTINA.slug),
        ]
    )


def test_lists_the_day_asked_for_by_number_for_that_store_only(
    stores: InMemoryStoreRepository, orders: InMemoryOrderRepository
) -> None:
    clock = FixedClock(datetime(2026, 10, 27, 15, 0, tzinfo=UTC))

    listed = ListOrdersUseCase(stores, orders, clock).execute(BEM_TE_VI.slug, MONDAY)

    assert [(order.store_slug, order.business_date, order.number) for order in listed] == [
        (BEM_TE_VI.slug, MONDAY, 1),
        (BEM_TE_VI.slug, MONDAY, 2),
    ]


def test_without_a_day_lists_today_in_sao_paulo(
    stores: InMemoryStoreRepository, orders: InMemoryOrderRepository
) -> None:
    clock = FixedClock(datetime(2026, 10, 27, 15, 0, tzinfo=UTC))

    listed = ListOrdersUseCase(stores, orders, clock).execute(BEM_TE_VI.slug, None)

    assert [(order.business_date, order.number) for order in listed] == [(TUESDAY, 1)]


def test_late_at_night_today_is_still_that_evenings_shift(
    stores: InMemoryStoreRepository, orders: InMemoryOrderRepository
) -> None:
    """2h30 UTC on Tuesday is 23h30 on Monday in São Paulo."""
    clock = FixedClock(datetime(2026, 10, 27, 2, 30, tzinfo=UTC))

    listed = ListOrdersUseCase(stores, orders, clock).execute(BEM_TE_VI.slug, None)

    assert [(order.business_date, order.number) for order in listed] == [(MONDAY, 1), (MONDAY, 2)]


def test_an_unknown_store_is_reported(
    stores: InMemoryStoreRepository, orders: InMemoryOrderRepository
) -> None:
    clock = FixedClock(datetime(2026, 10, 27, 15, 0, tzinfo=UTC))

    with pytest.raises(StoreNotFoundError) as raised:
        ListOrdersUseCase(stores, orders, clock).execute("outra-loja", MONDAY)

    assert str(raised.value) == "Loja não encontrada."
