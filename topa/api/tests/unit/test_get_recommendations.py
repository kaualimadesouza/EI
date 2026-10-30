import uuid
from datetime import datetime

import pytest

from tests.fakes import (
    FixedClock,
    InMemoryOrderRepository,
    InMemoryProductRepository,
    InMemoryStoreRepository,
)
from topa_api.application.get_recommendations import (
    GetRecommendations,
    GetRecommendationsQuery,
)
from topa_api.domain.catalog import Category, Product, Store
from topa_api.domain.errors import StoreNotFoundError
from topa_api.domain.orders import (
    BUSINESS_TIMEZONE,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
)
from topa_api.domain.recommendations import RecommendationStrategy

STORE = Store(slug="brasa-burgers", name="Brasa Burgers")

BURGER = Product(
    id="burger",
    name="Brasa Burger",
    description="Hambúrguer artesanal.",
    category=Category.LANCHES,
    price_cents=3200,
    available=True,
)
FRIES = Product(
    id="batata",
    name="Batata Rústica",
    description="Porção crocante.",
    category=Category.SALGADOS,
    price_cents=1600,
    available=True,
)
COCA = Product(
    id="coca",
    name="Refrigerante",
    description="Lata 350ml.",
    category=Category.BEBIDAS,
    price_cents=800,
    available=True,
)
BROWNIE = Product(
    id="brownie",
    name="Brownie de Chocolate",
    description="Com calda quente.",
    category=Category.DOCES,
    price_cents=1400,
    available=True,
)
SOLDOUT_SHAKE = Product(
    id="shake",
    name="Milkshake de Morango",
    description="Cremoso 400ml.",
    category=Category.BEBIDAS,
    price_cents=1800,
    available=False,
)


def make_use_case(
    hour: int = 12,
    past_orders: list[Order] | None = None,
    products: list[Product] | None = None,
) -> GetRecommendations:
    stores = InMemoryStoreRepository(stores=[STORE])
    catalog = products if products is not None else [BURGER, FRIES, COCA, BROWNIE, SOLDOUT_SHAKE]
    product_repo = InMemoryProductRepository(products_by_store={STORE.slug: catalog})
    clock = FixedClock(moment=datetime(2026, 10, 30, hour, 0, tzinfo=BUSINESS_TIMEZONE))
    order_repo = InMemoryOrderRepository()
    if past_orders:
        for order in past_orders:
            order_repo.add(order)
    return GetRecommendations(stores, product_repo, order_repo, clock)


def test_unknown_store_raises_store_not_found() -> None:
    use_case = make_use_case()
    query = GetRecommendationsQuery(store_slug="inexistente", cart_product_ids=())

    with pytest.raises(StoreNotFoundError):
        use_case.execute(query)


def test_ab_group_control_suppresses_recommendations() -> None:
    use_case = make_use_case()
    query = GetRecommendationsQuery(
        store_slug=STORE.slug,
        cart_product_ids=("burger",),
        client_id="ctrl-1",
    )
    result = use_case.execute(query)
    assert result.ab_group == "control"
    assert result.items == ()
    assert result.strategy_used == "control_suppressed"


def test_basket_recommendations_with_association_rules_and_cooccurrence() -> None:
    matched_order = Order(
        id=uuid.uuid4(),
        store_slug=STORE.slug,
        number=1,
        business_date=datetime(2026, 10, 30, tzinfo=BUSINESS_TIMEZONE).date(),
        status=OrderStatus.DELIVERED,
        dine_in=False,
        payment_method=PaymentMethod.PIX,
        items=(
            OrderItem(
                product_id="burger",
                name=BURGER.name,
                quantity=1,
                unit_price_cents=BURGER.price_cents,
            ),
            OrderItem(
                product_id="coca",
                name=COCA.name,
                quantity=1,
                unit_price_cents=COCA.price_cents,
            ),
        ),
        created_at=datetime(2026, 10, 30, 12, 0, tzinfo=BUSINESS_TIMEZONE),
    )
    unrelated_order = Order(
        id=uuid.uuid4(),
        store_slug=STORE.slug,
        number=2,
        business_date=datetime(2026, 10, 30, tzinfo=BUSINESS_TIMEZONE).date(),
        status=OrderStatus.DELIVERED,
        dine_in=False,
        payment_method=PaymentMethod.CARD,
        items=(
            OrderItem(
                product_id="coca",
                name=COCA.name,
                quantity=1,
                unit_price_cents=COCA.price_cents,
            ),
        ),
        created_at=datetime(2026, 10, 30, 12, 5, tzinfo=BUSINESS_TIMEZONE),
    )
    use_case = make_use_case(hour=12, past_orders=[matched_order, unrelated_order])
    query = GetRecommendationsQuery(
        store_slug=STORE.slug,
        cart_product_ids=("burger", "batata"),
        client_id="user-ctrl",
        limit=2,
    )

    result = use_case.execute(query)

    assert result.strategy_used == RecommendationStrategy.ASSOCIATION_RULES
    assert result.ab_group == "treatment"
    assert len(result.items) == 2
    assert result.items[0].product_id == "coca"
    assert result.items[0].category == Category.BEBIDAS
    product_ids = [item.product_id for item in result.items]
    assert "burger" not in product_ids
    assert "batata" not in product_ids
    assert "shake" not in product_ids


def test_empty_cart_uses_time_of_day_morning_lunch_and_evening() -> None:
    use_case_morning = make_use_case(hour=9)
    res_morning = use_case_morning.execute(
        GetRecommendationsQuery(store_slug=STORE.slug, cart_product_ids=(), client_id=None)
    )
    assert res_morning.strategy_used == RecommendationStrategy.TIME_OF_DAY
    assert res_morning.items[0].category in (Category.SALGADOS, Category.BEBIDAS)

    use_case_lunch = make_use_case(hour=13)
    res_lunch = use_case_lunch.execute(
        GetRecommendationsQuery(store_slug=STORE.slug, cart_product_ids=(), client_id=None)
    )
    assert res_lunch.strategy_used == RecommendationStrategy.TIME_OF_DAY
    assert res_lunch.items[0].category == Category.LANCHES

    use_case_evening = make_use_case(hour=16)
    res_evening = use_case_evening.execute(
        GetRecommendationsQuery(store_slug=STORE.slug, cart_product_ids=(), client_id=None)
    )
    assert res_evening.strategy_used == RecommendationStrategy.TIME_OF_DAY
    assert res_evening.items[0].category in (Category.DOCES, Category.BEBIDAS)


def test_empty_catalog_returns_empty_recommendations() -> None:
    use_case = make_use_case(products=[])
    result = use_case.execute(
        GetRecommendationsQuery(store_slug=STORE.slug, cart_product_ids=(), client_id=None)
    )
    assert result.items == ()


def test_tie_breaking_prioritizes_higher_price_for_ticket_lift() -> None:
    cheaper_snack = Product(
        id="pão-de-queijo",
        name="Pão de Queijo",
        description="Mineiro tradicional.",
        category=Category.SALGADOS,
        price_cents=600,
        available=True,
    )
    expensive_snack = Product(
        id="coxinha-catupiry",
        name="Coxinha com Catupiry",
        description="Frita na hora.",
        category=Category.SALGADOS,
        price_cents=1200,
        available=True,
    )
    use_case = make_use_case(
        hour=8,
        products=[cheaper_snack, expensive_snack],
    )
    result = use_case.execute(
        GetRecommendationsQuery(store_slug=STORE.slug, cart_product_ids=(), client_id=None, limit=2)
    )
    assert len(result.items) == 2
    assert result.items[0].product_id == "coxinha-catupiry"
    assert result.items[1].product_id == "pão-de-queijo"


def test_zero_or_negative_limit_returns_empty_tuple() -> None:
    use_case = make_use_case(hour=12)
    result = use_case.execute(
        GetRecommendationsQuery(store_slug=STORE.slug, cart_product_ids=(), client_id=None, limit=0)
    )
    assert result.items == ()
