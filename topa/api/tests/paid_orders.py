from collections.abc import Collection

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.fakes import FakePaymentGateway, InMemoryPaymentRepository
from topa_api.domain.orders import Order
from topa_api.domain.payment import PaymentStatus
from topa_api.presentation.fastapi.dependencies import get_payment_gateway


def paid_payments_for(orders: Collection[Order]) -> InMemoryPaymentRepository:
    payments = InMemoryPaymentRepository()
    gateway = FakePaymentGateway(next_status=PaymentStatus.PAID)
    for order in orders:
        payments.save_payment(gateway.create_pix_charge(order.id, order.total_cents, "Teste"))
    return payments


def confirm_pix(client: TestClient, order_id: str) -> None:
    """An explicitly paid gateway fixture; never sends money to a payment provider."""
    app = client.app
    assert isinstance(app, FastAPI)
    gateway = FakePaymentGateway(next_status=PaymentStatus.PAID)
    app.dependency_overrides[get_payment_gateway] = lambda: gateway
    response = client.post("/payments/pix", json={"order_id": order_id})
    assert response.status_code == 201
    assert response.json()["status"] == "PAID"
