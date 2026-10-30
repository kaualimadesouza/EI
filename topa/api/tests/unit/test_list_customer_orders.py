import uuid
from datetime import UTC, date, datetime

from topa_api.application.list_customer_orders import ListCustomerOrdersUseCase
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod


class FakeOrderRepository:
    def __init__(self, orders: list[Order]) -> None:
        self._orders = orders

    def next_number(self, store_slug: str, business_date: date) -> int:
        raise NotImplementedError

    def add(self, order: Order) -> None:
        raise NotImplementedError

    def list_for_day(self, store_slug: str, business_date: date) -> list[Order]:
        raise NotImplementedError

    def get(self, order_id: uuid.UUID) -> Order | None:
        raise NotImplementedError

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        raise NotImplementedError

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None:
        raise NotImplementedError

    def list_for_customer(self, customer_id: uuid.UUID) -> list[Order]:
        return [order for order in self._orders if order.customer_id == customer_id]


def test_lists_orders_belonging_to_customer() -> None:
    customer_id = uuid.uuid4()
    other_id = uuid.uuid4()
    item = OrderItem(
        product_id="xsalada",
        name="X-Salada",
        quantity=1,
        unit_price_cents=2200,
    )
    my_order = Order(
        id=uuid.uuid4(),
        store_slug="brasa-burgers",
        number=1,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(item,),
        created_at=datetime.now(UTC),
        customer_id=customer_id,
    )
    other_order = Order(
        id=uuid.uuid4(),
        store_slug="brasa-burgers",
        number=2,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=False,
        payment_method=PaymentMethod.CARD,
        items=(item,),
        created_at=datetime.now(UTC),
        customer_id=other_id,
    )
    repo = FakeOrderRepository([my_order, other_order])
    use_case = ListCustomerOrdersUseCase(repo)

    result = use_case.execute(customer_id)

    assert result == [my_order]
