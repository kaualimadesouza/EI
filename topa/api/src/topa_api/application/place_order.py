import uuid
from dataclasses import dataclass

from topa_api.application.ports import Clock, OrderRepository, ProductRepository
from topa_api.domain.orders import (
    Order,
    OrderLine,
    OrderStatus,
    PaymentMethod,
    business_date_of,
    merge_lines,
    price_lines,
)


@dataclass(frozen=True)
class PlaceOrder:
    lines: tuple[OrderLine, ...]
    dine_in: bool
    payment_method: PaymentMethod


class PlaceOrderUseCase:
    def __init__(self, products: ProductRepository, orders: OrderRepository, clock: Clock) -> None:
        self._products = products
        self._orders = orders
        self._clock = clock

    def execute(self, request: PlaceOrder) -> Order:
        lines = merge_lines(request.lines)
        items = price_lines(lines, self._products.find([line.product_id for line in lines]))
        created_at = self._clock.now()
        business_date = business_date_of(created_at)
        order = Order(
            id=uuid.uuid4(),
            number=self._orders.next_number(business_date),
            business_date=business_date,
            status=OrderStatus.RECEIVED,
            dine_in=request.dine_in,
            payment_method=request.payment_method,
            items=items,
            created_at=created_at,
        )
        self._orders.add(order)
        return order
