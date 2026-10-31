import uuid
from datetime import UTC, date, datetime, timedelta

import pytest

from tests.fakes import (
    FixedClock,
    InMemoryOrderRepository,
    InMemoryProductRepository,
    InMemoryStoreRepository,
)
from topa_api.application.place_order import PlaceOrder, PlaceOrderUseCase
from topa_api.domain.catalog import Category, Product, Store
from topa_api.domain.errors import (
    EmptyOrderError,
    ProductUnavailableError,
    QuantityOutOfRangeError,
    StoreNotFoundError,
    UnknownProductError,
)
from topa_api.domain.orders import OrderItem, OrderLine, OrderStatus, PaymentMethod

NOON_IN_SAO_PAULO = datetime(2026, 10, 26, 15, 0, tzinfo=UTC)
BEM_TE_VI = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
CANTINA = Store(slug="cantina-central", name="Cantina Central")

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
CANTINA_CATALOG = [
    Product(
        id="refri",
        name="Refrigerante lata",
        description="350 ml.",
        category=Category.BEBIDAS,
        price_cents=800,
        available=True,
    )
]


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(NOON_IN_SAO_PAULO)


@pytest.fixture
def orders() -> InMemoryOrderRepository:
    return InMemoryOrderRepository()


@pytest.fixture
def place_order(clock: FixedClock, orders: InMemoryOrderRepository) -> PlaceOrderUseCase:
    stores = InMemoryStoreRepository([BEM_TE_VI, CANTINA])
    products = InMemoryProductRepository(
        {BEM_TE_VI.slug: list(CATALOG), CANTINA.slug: list(CANTINA_CATALOG)}
    )
    return PlaceOrderUseCase(stores, products, orders, clock)


def _order_of(*lines: OrderLine, store_slug: str = BEM_TE_VI.slug) -> PlaceOrder:
    return PlaceOrder(
        store_slug=store_slug, lines=lines, dine_in=True, payment_method=PaymentMethod.PIX
    )


def test_prices_the_order_from_the_stores_catalog_and_stores_it(
    place_order: PlaceOrderUseCase, orders: InMemoryOrderRepository
) -> None:
    order = place_order.execute(
        PlaceOrder(
            store_slug=BEM_TE_VI.slug,
            lines=(
                OrderLine(product_id="xsalada", quantity=2),
                OrderLine(product_id="refri", quantity=1),
            ),
            dine_in=False,
            payment_method=PaymentMethod.CARD,
        )
    )

    assert order.store_slug == BEM_TE_VI.slug
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


def test_each_store_numbers_and_prices_its_own_orders(place_order: PlaceOrderUseCase) -> None:
    first_bem_te_vi = place_order.execute(_order_of(OrderLine(product_id="refri", quantity=1)))
    first_cantina = place_order.execute(
        _order_of(OrderLine(product_id="refri", quantity=1), store_slug=CANTINA.slug)
    )

    assert (first_bem_te_vi.number, first_bem_te_vi.total_cents) == (1, 690)
    assert (first_cantina.number, first_cantina.total_cents) == (1, 800)


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


@pytest.mark.parametrize(
    ("store_slug", "lines", "error"),
    [
        ("outra-loja", (OrderLine(product_id="refri", quantity=1),), StoreNotFoundError),
        ("outra-loja", (), EmptyOrderError),
        (
            "outra-loja",
            (
                OrderLine(product_id="refri", quantity=12),
                OrderLine(product_id="refri", quantity=12),
            ),
            QuantityOutOfRangeError,
        ),
        (BEM_TE_VI.slug, (), EmptyOrderError),
        (BEM_TE_VI.slug, (OrderLine(product_id="pastel", quantity=1),), UnknownProductError),
        (CANTINA.slug, (OrderLine(product_id="xsalada", quantity=1),), UnknownProductError),
        (BEM_TE_VI.slug, (OrderLine(product_id="coxinha", quantity=1),), ProductUnavailableError),
    ],
)
def test_an_order_that_breaks_a_rule_is_not_stored(
    place_order: PlaceOrderUseCase,
    orders: InMemoryOrderRepository,
    store_slug: str,
    lines: tuple[OrderLine, ...],
    error: type[Exception],
) -> None:
    with pytest.raises(error):
        place_order.execute(_order_of(*lines, store_slug=store_slug))

    assert orders.orders == []


def test_place_order_with_client_order_id_is_stored(
    place_order: PlaceOrderUseCase,
    orders: InMemoryOrderRepository,
) -> None:
    client_id = uuid.uuid4()
    req = PlaceOrder(
        store_slug=BEM_TE_VI.slug,
        lines=(OrderLine(product_id="xsalada", quantity=1),),
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        client_order_id=client_id,
    )
    order = place_order.execute(req)
    assert order.client_order_id == client_id
    assert len(orders.orders) == 1


def test_place_order_with_existing_client_order_id_returns_existing_order_idempotently(
    place_order: PlaceOrderUseCase,
    orders: InMemoryOrderRepository,
) -> None:
    client_id = uuid.uuid4()
    req = PlaceOrder(
        store_slug=BEM_TE_VI.slug,
        lines=(OrderLine(product_id="xsalada", quantity=1),),
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        client_order_id=client_id,
    )
    first_order = place_order.execute(req)
    second_order = place_order.execute(req)

    assert first_order.id == second_order.id
    assert first_order.number == second_order.number
    assert len(orders.orders) == 1
