import uuid
from datetime import UTC, date, datetime

import pytest

from tests.fakes import FakePaymentGateway, InMemoryOrderRepository, InMemoryPaymentRepository
from topa_api.application.create_pix_payment import (
    CreatePixPaymentCommand,
    CreatePixPaymentUseCase,
)
from topa_api.application.get_payment_status import GetPaymentStatusUseCase
from topa_api.application.process_payment_webhook import (
    ProcessPaymentWebhookUseCase,
    ProcessWebhookCommand,
)
from topa_api.domain.errors import (
    InvalidWebhookSignatureError,
    OrderNotFoundError,
    PaymentNotFoundError,
)
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod
from topa_api.domain.payment import PaymentStatus, PixCharge


def _make_order(order_id: uuid.UUID, total_cents: int = 3500) -> Order:
    return Order(
        id=order_id,
        store_slug="lanchonete-bem-te-vi",
        number=42,
        business_date=date(2026, 11, 1),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(
            OrderItem(
                product_id="xsalada",
                name="X-Salada",
                quantity=2,
                unit_price_cents=total_cents // 2,
            ),
        ),
        created_at=datetime.fromtimestamp(1893452400),
    )


def test_create_pix_payment_success() -> None:
    order_id = uuid.uuid4()
    order = _make_order(order_id, total_cents=3500)
    order_repo = InMemoryOrderRepository([order])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    use_case = CreatePixPaymentUseCase(
        orders=order_repo,
        payments=payment_repo,
        gateway=gateway,
    )

    cmd = CreatePixPaymentCommand(order_id=order_id)
    charge = use_case.execute(cmd)

    assert charge.order_id == order_id
    assert charge.amount_cents == 3500
    assert charge.status == PaymentStatus.PENDING
    assert charge.id in payment_repo.payments
    assert charge.br_code.startswith("000201")


def test_create_pix_payment_order_not_found() -> None:
    order_repo = InMemoryOrderRepository([])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    use_case = CreatePixPaymentUseCase(
        orders=order_repo,
        payments=payment_repo,
        gateway=gateway,
    )

    with pytest.raises(OrderNotFoundError):
        use_case.execute(CreatePixPaymentCommand(order_id=uuid.uuid4()))


def test_create_pix_payment_returns_existing_pending_or_paid() -> None:
    order_id = uuid.uuid4()
    order = _make_order(order_id, total_cents=3500)
    order_repo = InMemoryOrderRepository([order])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    use_case = CreatePixPaymentUseCase(
        orders=order_repo,
        payments=payment_repo,
        gateway=gateway,
    )

    charge1 = use_case.execute(CreatePixPaymentCommand(order_id=order_id))
    charge2 = use_case.execute(CreatePixPaymentCommand(order_id=order_id))

    assert charge1.id == charge2.id


def test_get_payment_status_updates_when_gateway_paid() -> None:
    order_id = uuid.uuid4()
    order = _make_order(order_id, total_cents=3500)
    order_repo = InMemoryOrderRepository([order])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    create_uc = CreatePixPaymentUseCase(orders=order_repo, payments=payment_repo, gateway=gateway)
    charge = create_uc.execute(CreatePixPaymentCommand(order_id=order_id))

    # Gateway reports PAID
    gateway.next_status = PaymentStatus.PAID
    get_status_uc = GetPaymentStatusUseCase(payments=payment_repo, gateway=gateway)

    updated = get_status_uc.execute(charge.id)
    assert updated.status == PaymentStatus.PAID
    saved = payment_repo.get_payment(charge.id)
    assert saved is not None
    assert saved.status == PaymentStatus.PAID


def test_get_payment_status_not_found() -> None:
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()
    get_status_uc = GetPaymentStatusUseCase(payments=payment_repo, gateway=gateway)

    with pytest.raises(PaymentNotFoundError):
        get_status_uc.execute("unknown-payment-id")


def test_process_webhook_success() -> None:
    order_id = uuid.uuid4()
    order = _make_order(order_id)
    order_repo = InMemoryOrderRepository([order])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    create_uc = CreatePixPaymentUseCase(orders=order_repo, payments=payment_repo, gateway=gateway)
    charge = create_uc.execute(CreatePixPaymentCommand(order_id=order_id))

    webhook_uc = ProcessPaymentWebhookUseCase(
        payments=payment_repo,
        gateway=gateway,
    )

    cmd = ProcessWebhookCommand(
        raw_body=b'{"event":"transparent.completed"}',
        signature="valid-sig",
        webhook_secret_param="my-secret",
        configured_secret="my-secret",
        event="transparent.completed",
        payment_id=charge.id,
        status="PAID",
        external_id=str(order_id),
    )

    processed = webhook_uc.execute(cmd)
    assert processed.status == PaymentStatus.PAID
    saved = payment_repo.get_payment(charge.id)
    assert saved is not None
    assert saved.status == PaymentStatus.PAID


def test_process_webhook_invalid_secret_or_signature() -> None:
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway(valid_signature=False)

    webhook_uc = ProcessPaymentWebhookUseCase(
        payments=payment_repo,
        gateway=gateway,
    )

    # Wrong secret param
    cmd_bad_secret = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="wrong-secret",
        configured_secret="expected-secret",
        event="billing.paid",
        payment_id="pay_1",
        status="PAID",
    )
    with pytest.raises(InvalidWebhookSignatureError):
        webhook_uc.execute(cmd_bad_secret)

    # Invalid signature
    cmd_bad_sig = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="invalid-sig",
        webhook_secret_param="expected-secret",
        configured_secret="expected-secret",
        event="billing.paid",
        payment_id="pay_1",
        status="PAID",
    )
    with pytest.raises(InvalidWebhookSignatureError):
        webhook_uc.execute(cmd_bad_sig)

    # Missing configured secret (fail-closed)
    cmd_no_secret = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="secret",
        configured_secret=None,
        event="billing.paid",
        payment_id="pay_1",
        status="PAID",
    )
    with pytest.raises(InvalidWebhookSignatureError):
        webhook_uc.execute(cmd_no_secret)


def test_process_webhook_fallback_external_id_and_failed_status() -> None:
    order_id = uuid.uuid4()
    order_repo = InMemoryOrderRepository([_make_order(order_id)])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    create_uc = CreatePixPaymentUseCase(orders=order_repo, payments=payment_repo, gateway=gateway)
    create_uc.execute(CreatePixPaymentCommand(order_id=order_id))

    webhook_uc = ProcessPaymentWebhookUseCase(
        payments=payment_repo,
        gateway=gateway,
    )

    # Using different payment_id but matching external_id (order_id)
    cmd = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="secret",
        configured_secret="secret",
        event="billing.failed",
        payment_id="other_charge_id",
        status="FAILED",
        external_id=str(order_id),
    )

    processed = webhook_uc.execute(cmd)
    assert processed.status == PaymentStatus.FAILED

    # Expired event
    cmd_expired = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="secret",
        configured_secret="secret",
        event="billing.expired",
        payment_id="other_charge_id",
        status="EXPIRED",
        external_id=str(order_id),
    )
    processed_expired = webhook_uc.execute(cmd_expired)
    assert processed_expired.status == PaymentStatus.EXPIRED

    # Unknown or pending status preserves current status
    cmd_pending = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="secret",
        configured_secret="secret",
        event="unknown.event",
        payment_id="other_charge_id",
        status="PENDING",
        external_id=str(order_id),
    )
    processed_pending = webhook_uc.execute(cmd_pending)
    assert processed_pending.status == PaymentStatus.EXPIRED


def test_process_webhook_does_not_downgrade_paid_status() -> None:
    order_id = uuid.uuid4()
    order_repo = InMemoryOrderRepository([_make_order(order_id)])
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    create_uc = CreatePixPaymentUseCase(orders=order_repo, payments=payment_repo, gateway=gateway)
    charge = create_uc.execute(CreatePixPaymentCommand(order_id=order_id))
    payment_repo.update_payment_status(charge.id, PaymentStatus.PAID)

    webhook_uc = ProcessPaymentWebhookUseCase(payments=payment_repo, gateway=gateway)
    cmd = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="secret",
        configured_secret="secret",
        event="billing.failed",
        payment_id=charge.id,
        status="FAILED",
    )
    result = webhook_uc.execute(cmd)
    assert result.status == PaymentStatus.PAID


def test_process_webhook_not_found() -> None:
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()

    webhook_uc = ProcessPaymentWebhookUseCase(
        payments=payment_repo,
        gateway=gateway,
    )

    cmd = ProcessWebhookCommand(
        raw_body=b"{}",
        signature="sig",
        webhook_secret_param="secret",
        configured_secret="secret",
        event="transparent.completed",
        payment_id="unknown_id",
        status="PAID",
        external_id="invalid-uuid",
    )

    with pytest.raises(PaymentNotFoundError):
        webhook_uc.execute(cmd)


def test_get_payment_status_already_paid_skips_gateway() -> None:
    order_id = uuid.uuid4()
    payment_repo = InMemoryPaymentRepository()
    gateway = FakePaymentGateway()
    charge = PixCharge(
        id="pay_already_paid",
        order_id=order_id,
        amount_cents=1000,
        status=PaymentStatus.PAID,
        br_code="000201...",
        br_code_base64=None,
        qr_code_url=None,
        expires_at=None,
        created_at=datetime.now(UTC),
    )
    payment_repo.save_payment(charge)
    get_status_uc = GetPaymentStatusUseCase(payments=payment_repo, gateway=gateway)
    res = get_status_uc.execute("pay_already_paid")
    assert res.status == PaymentStatus.PAID
