import uuid

from topa_api.application.ports import OrderRepository
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.orders import Order, OrderStatus


class ChangeOrderStatusUseCase:
    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    def execute(self, order_id: uuid.UUID, status: OrderStatus) -> Order:
        order = self._orders.get_for_update(order_id)
        if order is None:
            raise OrderNotFoundError
        moved = order.moved_to(status)
        self._orders.set_status(order_id, status)
        return moved
