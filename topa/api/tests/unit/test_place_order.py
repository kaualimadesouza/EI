from datetime import UTC, date, datetime, timedelta

import pytest

from tests.fakes import FixedClock, InMemoryOrderRepository, InMemoryProductRepository
from topa_api.application.place_order import PlaceOrder, PlaceOrderUseCase
from topa_api.domain.catalog import Category, Product
from topa_api.domain.errors import (
    EmptyOrderError,
    OrderNumberTakenError,
    ProductUnavailableError,
    UnknownProductError,
)
from topa_api.domain.orders import OrderItem, OrderLine, OrderStatus, PaymentMethod

NOON_IN_SAO_PAULO = datetime(2026, 10, 26, 15, 0, tzinfo=UTC)

CATALOG = [
    Product(
        id="xsalada",
        name="X-salada",
        description="Hambúrguer, queijo, alface e tomate.",
        category=Category.LANCHES,
        price_cents=2290,
        available=True,
    ),
    Product(
        id="refri",
        name="Refrigerante",
        description="Copo de 350 ml com gelo.",
        category=Category.BEBIDAS,
        price_cents=690,
        available=True,
    ),
    Product(
        id="coxinha",
        name="Coxinha",
        description="Frango com catupiry.",
        category=Category.SALGADOS,
        price_cents=890,
        available=False,
    ),
]


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(NOON_IN_SAO_PAULO)


@pytest.fixture
def orders() -> InMemoryOrderRepository:
    return InMemoryOrderRepository()


@pytest.fixture
def place_order(clock: FixedClock, orders: InMemoryOrderRepository) -> PlaceOrderUseCase:
    return PlaceOrderUseCase(InMemoryProductRepository(CATALOG), orders, clock)


def _order_of(*lines: OrderLine) -> PlaceOrder:
    return PlaceOrder(lines=lines, dine_in=True, payment_method=PaymentMethod.PIX)


def test_prices_the_order_from_the_catalog_and_stores_it(
    place_order: PlaceOrderUseCase, orders: InMemoryOrderRepository
) -> None:
    order = place_order.execute(
        PlaceOrder(
            lines=(
                OrderLine(product_id="xsalada", quantity=2),
                OrderLine(product_id="refri", quantity=1),
            ),
            dine_in=False,
            payment_method=PaymentMethod.CARD,
        )
    )

    assert order.number == 1
    assert order.status == OrderStatus.RECEIVED
    assert order.dine_in is False
    assert order.payment_method == PaymentMethod.CARD
    assert order.items == (
        OrderItem(product_id="xsalada", name="X-salada", quantity=2, unit_price_cents=2290),
        OrderItem(product_id="refri", name="Refrigerante", quantity=1, unit_price_cents=690),
    )
    assert order.total_cents == 5270
    assert order.created_at == NOON_IN_SAO_PAULO
    assert order.business_date == date(2026, 10, 26)
    assert orders.orders == [order]


def test_each_order_gets_its_own_id(place_order: PlaceOrderUseCase) -> None:
    first = place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))
    second = place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))

    assert first.id != second.id


def test_numbers_count_up_within_the_business_day(place_order: PlaceOrderUseCase) -> None:
    numbers = [
        place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1))).number
        for _ in range(3)
    ]

    assert numbers == [1, 2, 3]


def test_numbers_restart_on_the_next_business_day(
    place_order: PlaceOrderUseCase, clock: FixedClock
) -> None:
    place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))
    clock.moment = NOON_IN_SAO_PAULO + timedelta(days=1)

    order = place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))

    assert order.number == 1
    assert order.business_date == date(2026, 10, 27)


def test_repeated_products_become_one_item(place_order: PlaceOrderUseCase) -> None:
    order = place_order.execute(
        _order_of(
            OrderLine(product_id="xsalada", quantity=1),
            OrderLine(product_id="refri", quantity=2),
            OrderLine(product_id="xsalada", quantity=2),
        )
    )

    assert [(item.product_id, item.quantity) for item in order.items] == [
        ("xsalada", 3),
        ("refri", 2),
    ]


def test_retries_once_when_another_kiosk_took_the_number(
    place_order: PlaceOrderUseCase, orders: InMemoryOrderRepository
) -> None:
    orders.collisions = 1

    order = place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))

    assert order.number == 2
    assert orders.orders == [order]


def test_gives_up_when_the_number_is_taken_twice(
    place_order: PlaceOrderUseCase, orders: InMemoryOrderRepository
) -> None:
    orders.collisions = 2

    with pytest.raises(OrderNumberTakenError):
        place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))

    assert orders.orders == []


@pytest.mark.parametrize(
    ("lines", "error"),
    [
        ((), EmptyOrderError),
        ((OrderLine(product_id="pastel", quantity=1),), UnknownProductError),
        ((OrderLine(product_id="coxinha", quantity=1),), ProductUnavailableError),
    ],
)
def test_an_order_that_breaks_a_rule_is_not_stored(
    place_order: PlaceOrderUseCase,
    orders: InMemoryOrderRepository,
    lines: tuple[OrderLine, ...],
    error: type[Exception],
) -> None:
    with pytest.raises(error):
        place_order.execute(_order_of(*lines))

    assert orders.orders == []
