import uuid

from topa_api.application.ports import OrderRepository
from topa_api.domain.errors import ForbiddenStoreAccessError, OrderNotFoundError
from topa_api.domain.orders import Order, OrderStatus


class ChangeOrderStatusUseCase:
    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    def execute(
        self, order_id: uuid.UUID, status: OrderStatus, store_slug: str | None = None
    ) -> Order:
        order = self._orders.get_for_update(order_id)
        if order is None:
            raise OrderNotFoundError
        if store_slug is not None and order.store_slug != store_slug:
            raise ForbiddenStoreAccessError()
        moved = order.moved_to(status)
        self._orders.set_status(order_id, status)
        return moved
