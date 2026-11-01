import uuid
from datetime import UTC, datetime

from topa_api.domain.errors import (
    InvalidWebhookSignatureError,
    PaymentNotFoundError,
    PaymentProcessingError,
)
from topa_api.domain.payment import PaymentStatus, PixCharge


def test_pix_charge_domain_entity_creation() -> None:
    order_id = uuid.uuid4()
    now = datetime.now(UTC)
    charge = PixCharge(
        id="bill_12345",
        order_id=order_id,
        amount_cents=2590,
        status=PaymentStatus.PENDING,
        br_code="000201...",
        br_code_base64="data:image/png;base64,abc",
        qr_code_url="https://pay.abacatepay.com/bill-12345",
        expires_at=now,
        created_at=now,
    )

    assert charge.id == "bill_12345"
    assert charge.order_id == order_id
    assert charge.amount_cents == 2590
    assert charge.status == PaymentStatus.PENDING
    assert charge.br_code == "000201..."
    assert charge.br_code_base64 == "data:image/png;base64,abc"
    assert charge.qr_code_url == "https://pay.abacatepay.com/bill-12345"
    assert charge.expires_at == now
    assert charge.created_at == now


def test_payment_status_values() -> None:
    assert PaymentStatus.PENDING == "PENDING"
    assert PaymentStatus.PAID == "PAID"
    assert PaymentStatus.FAILED == "FAILED"
    assert PaymentStatus.EXPIRED == "EXPIRED"


def test_payment_domain_errors_messages() -> None:
    not_found = PaymentNotFoundError()
    assert str(not_found) == "Cobrança não encontrada."

    processing = PaymentProcessingError()
    assert str(processing) == "Falha ao processar pagamento com o gateway."

    custom_processing = PaymentProcessingError("Gateway timeout")
    assert str(custom_processing) == "Gateway timeout"

    sig_error = InvalidWebhookSignatureError()
    assert str(sig_error) == "Assinatura de webhook inválida."


def test_payment_dependencies_defaults() -> None:
    import pytest

    from tests.fakes import FakePaymentGateway, InMemoryOrderRepository, InMemoryPaymentRepository
    from topa_api.presentation.fastapi.dependencies import (
        get_abacatepay_webhook_secret,
        get_create_pix_payment_use_case,
        get_payment_gateway,
        get_payment_repository,
        get_payment_status_use_case,
        get_process_payment_webhook_use_case,
    )

    with pytest.raises(NotImplementedError):
        get_payment_gateway()

    with pytest.raises(NotImplementedError):
        get_payment_repository()

    assert get_abacatepay_webhook_secret() is None

    orders = InMemoryOrderRepository()
    payments = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    create_uc = get_create_pix_payment_use_case(orders, payments, gateway)
    assert create_uc is not None

    status_uc = get_payment_status_use_case(payments, gateway)
    assert status_uc is not None

    webhook_uc = get_process_payment_webhook_use_case(payments, gateway)
    assert webhook_uc is not None
