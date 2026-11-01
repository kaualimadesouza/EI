import hmac
import uuid
from dataclasses import dataclass, replace

from topa_api.application.ports import PaymentGatewayPort, PaymentRepositoryPort
from topa_api.domain.errors import InvalidWebhookSignatureError, PaymentNotFoundError
from topa_api.domain.payment import PaymentStatus, PixCharge


@dataclass(frozen=True)
class ProcessWebhookCommand:
    raw_body: bytes
    signature: str | None
    webhook_secret_param: str | None
    configured_secret: str | None
    event: str
    payment_id: str
    status: str
    external_id: str | None = None


class ProcessPaymentWebhookUseCase:
    """Processes Abacate Pay webhook events and updates payment status."""

    def __init__(
        self,
        payments: PaymentRepositoryPort,
        gateway: PaymentGatewayPort,
    ) -> None:
        self._payments = payments
        self._gateway = gateway

    def execute(self, cmd: ProcessWebhookCommand) -> PixCharge:
        if not cmd.configured_secret:
            raise InvalidWebhookSignatureError
        if not cmd.webhook_secret_param or not hmac.compare_digest(
            cmd.webhook_secret_param, cmd.configured_secret
        ):
            raise InvalidWebhookSignatureError
        if not cmd.signature or not self._gateway.verify_webhook_signature(
            cmd.raw_body, cmd.signature, cmd.configured_secret
        ):
            raise InvalidWebhookSignatureError

        charge = self._payments.get_payment(cmd.payment_id)
        if charge is None and cmd.external_id:
            try:
                order_id = uuid.UUID(cmd.external_id)
                charge = self._payments.get_payment_by_order_id(order_id)
            except ValueError:
                charge = None

        if charge is None:
            raise PaymentNotFoundError

        if charge.status == PaymentStatus.PAID:
            return charge

        status_str = cmd.status.upper()
        event_str = cmd.event.lower()

        if status_str in ("PAID", "COMPLETED") or event_str in (
            "transparent.completed",
            "billing.paid",
        ):
            new_status = PaymentStatus.PAID
        elif status_str in ("FAILED", "CANCELED") or event_str in (
            "billing.failed",
            "billing.canceled",
        ):
            new_status = PaymentStatus.FAILED
        elif status_str == "EXPIRED" or event_str == "billing.expired":
            new_status = PaymentStatus.EXPIRED
        else:
            new_status = charge.status

        if new_status != charge.status:
            self._payments.update_payment_status(charge.id, new_status)
            charge = replace(charge, status=new_status)

        return charge
