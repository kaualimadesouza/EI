import uuid

from topa_api.application.ports import OrderRepository
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.orders import Order


class ReadOrderUseCase:
    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    def execute(self, order_id: uuid.UUID) -> Order:
        order = self._orders.get(order_id)
        if order is None:
            raise OrderNotFoundError
        return order
