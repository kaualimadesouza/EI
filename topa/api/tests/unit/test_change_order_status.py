import uuid
from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from tests.fakes import InMemoryOrderRepository
from topa_api.application.change_order_status import ChangeOrderStatusUseCase
from topa_api.domain.errors import OrderNotFoundError, StatusChangeNotAllowedError
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

PLACED = Order(
    id=uuid.uuid4(),
    store_slug="lanchonete-bem-te-vi",
    number=7,
    business_date=date(2026, 10, 26),
    status=OrderStatus.RECEIVED,
    dine_in=True,
    payment_method=PaymentMethod.PIX,
    items=(OrderItem(product_id="cafe", name="Café coado", quantity=2, unit_price_cents=550),),
    created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
)


@pytest.fixture
def orders() -> InMemoryOrderRepository:
    return InMemoryOrderRepository(orders=[PLACED])


def test_stores_the_new_status_and_returns_the_moved_order(
    orders: InMemoryOrderRepository,
) -> None:
    moved = ChangeOrderStatusUseCase(orders).execute(PLACED.id, OrderStatus.PREPARING)

    assert moved == replace(PLACED, status=OrderStatus.PREPARING)
    assert orders.orders == [moved]


def test_an_unknown_order_is_reported(orders: InMemoryOrderRepository) -> None:
    with pytest.raises(OrderNotFoundError) as raised:
        ChangeOrderStatusUseCase(orders).execute(uuid.uuid4(), OrderStatus.PREPARING)

    assert str(raised.value) == "Pedido não encontrado."
    assert orders.orders == [PLACED]


def test_a_refused_change_leaves_the_order_as_it_was(orders: InMemoryOrderRepository) -> None:
    with pytest.raises(StatusChangeNotAllowedError):
        ChangeOrderStatusUseCase(orders).execute(PLACED.id, OrderStatus.DELIVERED)

    assert orders.orders == [PLACED]
