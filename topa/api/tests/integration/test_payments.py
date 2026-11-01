import base64
import hashlib
import hmac
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.models import PaymentRow
from topa_api.presentation.fastapi import dependencies as ports


def _create_test_order(client: TestClient) -> str:
    response = client.post(
        "/orders",
        json={
            "items": [{"product_id": "xsalada", "quantity": 1}],
            "dine_in": True,
            "payment_method": "pix",
        },
    )
    assert response.status_code == 201
    return str(response.json()["id"])


def test_create_pix_payment_success_and_idempotent(client: TestClient) -> None:
    order_id = _create_test_order(client)

    resp1 = client.post("/payments/pix", json={"order_id": order_id})
    assert resp1.status_code == 201
    body1 = resp1.json()
    assert body1["order_id"] == order_id
    assert body1["amount_cents"] == 2290
    assert body1["status"] == "PENDING"
    assert body1["br_code"].startswith("000201")
    assert body1["id"].startswith("pix_")

    resp2 = client.post("/payments/pix", json={"order_id": order_id})
    assert resp2.status_code == 201
    body2 = resp2.json()
    assert body2["id"] == body1["id"]
    assert body2["br_code"] == body1["br_code"]


def test_create_pix_payment_order_not_found(client: TestClient) -> None:
    non_existent = str(uuid.uuid4())
    resp = client.post("/payments/pix", json={"order_id": non_existent})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Pedido não encontrado."


def test_get_payment_status_success_and_not_found(client: TestClient) -> None:
    order_id = _create_test_order(client)
    create_resp = client.post("/payments/pix", json={"order_id": order_id})
    payment_id = create_resp.json()["id"]

    status_resp = client.get(f"/payments/{payment_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["id"] == payment_id
    assert status_resp.json()["status"] == "PENDING"

    not_found = client.get("/payments/unknown-payment-id/status")
    assert not_found.status_code == 404
    assert not_found.json()["detail"] == "Cobrança não encontrada."


def test_abacatepay_webhook_flow_with_signature(app: FastAPI, db_engine: Engine) -> None:
    webhook_secret = "test-webhook-secret-xyz"
    app.dependency_overrides[ports.get_abacatepay_webhook_secret] = lambda: webhook_secret
    client = TestClient(app)

    order_id = _create_test_order(client)
    charge_resp = client.post("/payments/pix", json={"order_id": order_id})
    payment_id = charge_resp.json()["id"]

    raw_body = (
        f'{{"event":"transparent.completed","data":{{"id":"{payment_id}",'
        f'"status":"PAID","externalId":"{order_id}"}}}}'
    ).encode()

    digest = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    sig = base64.b64encode(digest).decode("utf-8")

    # Invalid secret in query param
    bad_secret_resp = client.post(
        "/payments/webhook/abacatepay?webhookSecret=wrong-secret",
        content=raw_body,
        headers={"X-Webhook-Signature": sig, "Content-Type": "application/json"},
    )
    assert bad_secret_resp.status_code == 401

    # Invalid signature in header
    bad_sig_resp = client.post(
        f"/payments/webhook/abacatepay?webhookSecret={webhook_secret}",
        content=raw_body,
        headers={"X-Webhook-Signature": "invalid-sig", "Content-Type": "application/json"},
    )
    assert bad_sig_resp.status_code == 401

    # Valid webhook delivery
    ok_resp = client.post(
        f"/payments/webhook/abacatepay?webhookSecret={webhook_secret}",
        content=raw_body,
        headers={"X-Webhook-Signature": sig, "Content-Type": "application/json"},
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json() == {"status": "ok"}

    # Verify database state
    with Session(db_engine) as session:
        payment = session.get(PaymentRow, payment_id)
        assert payment is not None
        assert payment.status == "PAID"
        assert payment.created_at is not None

    # Malformed JSON payload handling
    malformed_body = b"not-a-valid-json"
    malformed_sig = base64.b64encode(
        hmac.new(webhook_secret.encode("utf-8"), malformed_body, hashlib.sha256).digest()
    ).decode("utf-8")
    malformed_resp = client.post(
        f"/payments/webhook/abacatepay?webhookSecret={webhook_secret}",
        content=malformed_body,
        headers={"X-Webhook-Signature": malformed_sig, "Content-Type": "application/json"},
    )
    assert malformed_resp.status_code == 404
