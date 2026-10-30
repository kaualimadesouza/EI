import uuid

from topa_api.application.ports import OrderRepository
from topa_api.domain.orders import Order


class ListCustomerOrdersUseCase:
    """Returns all orders placed by the given customer."""

    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    def execute(self, customer_id: uuid.UUID) -> list[Order]:
        return self._orders.list_for_customer(customer_id)
