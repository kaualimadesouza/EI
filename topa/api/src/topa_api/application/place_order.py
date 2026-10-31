import uuid
from dataclasses import dataclass

from topa_api.application.ports import Clock, OrderRepository, ProductRepository, StoreRepository
from topa_api.domain.errors import StoreNotFoundError
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
    store_slug: str
    lines: tuple[OrderLine, ...]
    dine_in: bool
    payment_method: PaymentMethod
    customer_id: uuid.UUID | None = None
    client_order_id: uuid.UUID | None = None


class PlaceOrderUseCase:
    def __init__(
        self,
        stores: StoreRepository,
        products: ProductRepository,
        orders: OrderRepository,
        clock: Clock,
    ) -> None:
        self._stores = stores
        self._products = products
        self._orders = orders
        self._clock = clock

    def execute(self, request: PlaceOrder) -> Order:
        if request.client_order_id is not None:
            existing = self._orders.get_by_client_order_id(
                request.store_slug, request.client_order_id
            )
            if existing is not None:
                return existing
        lines = merge_lines(request.lines)
        if self._stores.get(request.store_slug) is None:
            raise StoreNotFoundError
        catalog = self._products.find(request.store_slug, [line.product_id for line in lines])
        items = price_lines(lines, catalog)
        created_at = self._clock.now()
        business_date = business_date_of(created_at)
        order = Order(
            id=uuid.uuid4(),
            store_slug=request.store_slug,
            number=self._orders.next_number(request.store_slug, business_date),
            business_date=business_date,
            status=OrderStatus.RECEIVED,
            dine_in=request.dine_in,
            payment_method=request.payment_method,
            items=items,
            created_at=created_at,
            customer_id=request.customer_id,
            client_order_id=request.client_order_id,
        )
        self._orders.add(order)
        return order
