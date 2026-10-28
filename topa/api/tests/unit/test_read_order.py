import uuid
from datetime import UTC, date, datetime

import pytest

from tests.fakes import InMemoryOrderRepository
from topa_api.application.read_order import ReadOrderUseCase
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

PLACED = Order(
    id=uuid.uuid4(),
    number=7,
    business_date=date(2026, 10, 26),
    status=OrderStatus.READY,
    dine_in=False,
    payment_method=PaymentMethod.CARD,
    items=(OrderItem(product_id="cafe", name="Café coado", quantity=1, unit_price_cents=550),),
    created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
)


def test_returns_the_order_as_it_stands() -> None:
    orders = InMemoryOrderRepository(orders=[PLACED])

    assert ReadOrderUseCase(orders).execute(PLACED.id) == PLACED


def test_an_unknown_order_is_reported() -> None:
    with pytest.raises(OrderNotFoundError) as raised:
        ReadOrderUseCase(InMemoryOrderRepository(orders=[PLACED])).execute(uuid.uuid4())

    assert str(raised.value) == "Pedido não encontrado."
