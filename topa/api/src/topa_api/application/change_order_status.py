import uuid

from topa_api.application.payment_confirmation import payment_is_confirmed
from topa_api.application.ports import OrderRepository, PaymentRepositoryPort
from topa_api.domain.errors import (
    ForbiddenStoreAccessError,
    OrderNotFoundError,
    PaymentNotConfirmedError,
)
from topa_api.domain.orders import Order, OrderStatus


class ChangeOrderStatusUseCase:
    def __init__(self, orders: OrderRepository, payments: PaymentRepositoryPort) -> None:
        self._orders = orders
        self._payments = payments

    def execute(
        self, order_id: uuid.UUID, status: OrderStatus, store_slug: str | None = None
    ) -> Order:
        order = self._orders.get_for_update(order_id)
        if order is None:
            raise OrderNotFoundError
        if store_slug is not None and order.store_slug != store_slug:
            raise ForbiddenStoreAccessError()
        if not payment_is_confirmed(order, self._payments):
            raise PaymentNotConfirmedError()
        moved = order.moved_to(status)
        self._orders.set_status(order_id, status)
        return moved
