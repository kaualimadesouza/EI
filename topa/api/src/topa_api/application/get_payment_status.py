from dataclasses import replace

from topa_api.application.ports import PaymentGatewayPort, PaymentRepositoryPort
from topa_api.domain.errors import PaymentNotFoundError
from topa_api.domain.payment import PaymentStatus, PixCharge


class GetPaymentStatusUseCase:
    """Retrieves payment status, syncing with gateway when pending."""

    def __init__(
        self,
        payments: PaymentRepositoryPort,
        gateway: PaymentGatewayPort,
    ) -> None:
        self._payments = payments
        self._gateway = gateway

    def execute(self, payment_id: str) -> PixCharge:
        charge = self._payments.get_payment(payment_id)
        if charge is None:
            raise PaymentNotFoundError

        if charge.status == PaymentStatus.PENDING:
            gateway_status = self._gateway.get_payment_status(payment_id)
            if gateway_status != charge.status:
                self._payments.update_payment_status(payment_id, gateway_status)
                charge = replace(charge, status=gateway_status)

        return charge
