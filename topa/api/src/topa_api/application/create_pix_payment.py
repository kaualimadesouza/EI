import uuid
from dataclasses import dataclass

from topa_api.application.ports import OrderRepository, PaymentGatewayPort, PaymentRepositoryPort
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.payment import PaymentStatus, PixCharge


@dataclass(frozen=True)
class CreatePixPaymentCommand:
    order_id: uuid.UUID
    description: str | None = None
    customer_email: str | None = None
    customer_name: str | None = None


class CreatePixPaymentUseCase:
    """Creates or returns an active Pix payment charge for an order."""

    def __init__(
        self,
        orders: OrderRepository,
        payments: PaymentRepositoryPort,
        gateway: PaymentGatewayPort,
    ) -> None:
        self._orders = orders
        self._payments = payments
        self._gateway = gateway

    def execute(self, cmd: CreatePixPaymentCommand) -> PixCharge:
        order = self._orders.get(cmd.order_id)
        if order is None:
            raise OrderNotFoundError

        existing = self._payments.get_payment_by_order_id(cmd.order_id)
        if existing is not None and existing.status in (PaymentStatus.PENDING, PaymentStatus.PAID):
            return existing

        amount = order.total_cents
        desc = cmd.description or f"Pedido TOPA #{order.number} - Loja {order.store_slug}"

        charge = self._gateway.create_pix_charge(
            order_id=cmd.order_id,
            amount_cents=amount,
            description=desc,
            customer_email=cmd.customer_email,
            customer_name=cmd.customer_name,
        )
        self._payments.save_payment(charge)
        return charge
