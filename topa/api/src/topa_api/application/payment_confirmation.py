from topa_api.application.ports import PaymentRepositoryPort
from topa_api.domain.orders import Order
from topa_api.domain.payment import PaymentStatus


def payment_is_confirmed(order: Order, payments: PaymentRepositoryPort) -> bool:
    charge = payments.get_payment_by_order_id(order.id)
    return charge is not None and charge.status == PaymentStatus.PAID
