import uuid
from datetime import UTC, date, datetime

from tests.fakes import InMemoryOrderRepository
from topa_api.application.list_customer_orders import ListCustomerOrdersUseCase
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod


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
    repo = InMemoryOrderRepository([my_order, other_order])
    use_case = ListCustomerOrdersUseCase(repo)

    result = use_case.execute(customer_id)

    assert result == [my_order]
