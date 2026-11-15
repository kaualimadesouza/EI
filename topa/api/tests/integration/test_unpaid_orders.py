import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.fakes import FakePaymentGateway
from topa_api.domain.payment import PaymentStatus
from topa_api.presentation.fastapi.dependencies import get_payment_gateway


@pytest.mark.parametrize("method", ["pix", "card"])
def test_orders_reach_kitchen_and_revenue_only_after_gateway_confirmation(
    client: TestClient,
    app: FastAPI,
    auth_headers: dict[str, str],
    method: str,
) -> None:
    gateway = FakePaymentGateway()
    app.dependency_overrides[get_payment_gateway] = lambda: gateway
    order = client.post(
        "/orders",
        json={
            "store_slug": "lanchonete-bem-te-vi",
            "items": [{"product_id": "cafe", "quantity": 1}],
            "dine_in": True,
            "payment_method": method,
        },
    ).json()
    assert client.get("/orders", headers=auth_headers).json() == []
    refused = client.patch(
        f"/orders/{order['id']}", json={"status": "preparing"}, headers=auth_headers
    )
    assert refused.status_code == 409
    assert "pagamento" in refused.json()["detail"]
    charge = client.post("/payments/pix", json={"order_id": order["id"]}).json()
    assert client.get("/orders", headers=auth_headers).json() == []
    gateway.next_status = PaymentStatus.PAID
    assert client.get(f"/payments/{charge['id']}/status").json()["status"] == "PAID"
    listed = client.get("/orders", headers=auth_headers).json()
    assert [item["id"] for item in listed] == [order["id"]]
    assert listed[0]["total_cents"] == 550
    assert (
        client.patch(
            f"/orders/{order['id']}", json={"status": "preparing"}, headers=auth_headers
        ).status_code
        == 200
    )
