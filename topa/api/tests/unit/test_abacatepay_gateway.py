import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime
from typing import Any

import pytest

from topa_api.adapters.payment.abacatepay_gateway import AbacatePayGateway
from topa_api.domain.errors import PaymentProcessingError
from topa_api.domain.payment import PaymentStatus


class DummyResponse:
    def __init__(self, data: dict[str, Any], status: int = 200) -> None:
        self._raw = json.dumps(data).encode("utf-8")
        self.status = status

    def read(self) -> bytes:
        return self._raw

    def __enter__(self) -> "DummyResponse":
        return self

    def __exit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        pass


def test_abacatepay_gateway_mock_mode_when_no_api_key() -> None:
    gateway = AbacatePayGateway(api_key=None)
    order_id = uuid.uuid4()
    charge = gateway.create_pix_charge(
        order_id=order_id,
        amount_cents=1990,
        description="Pedido de teste",
    )

    assert charge.order_id == order_id
    assert charge.amount_cents == 1990
    assert charge.status == PaymentStatus.PENDING
    assert charge.br_code.startswith("000201")
    assert "TOPA" in charge.br_code
    assert gateway.get_payment_status(charge.id) == PaymentStatus.PENDING


def test_abacatepay_gateway_live_call_success(monkeypatch: pytest.MonkeyPatch) -> None:
    order_id = uuid.uuid4()
    expected_resp = {
        "data": {
            "id": "pix_char_live_123",
            "brCode": "00020126580014br.gov.bcb.pix...",
            "brCodeBase64": "data:image/png;base64,mockqr",
            "url": "https://pay.abacatepay.com/bill-live",
            "expiresAt": "2026-11-01T15:30:00Z",
        }
    }

    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        assert req.get_header("Authorization") == "Bearer abc_dev_live_key"
        assert req.get_method() == "POST"
        raw_req_data = req.data
        assert isinstance(raw_req_data, bytes)
        body = json.loads(raw_req_data.decode("utf-8"))
        assert body["data"]["amount"] == 2990
        assert body["data"]["externalId"] == str(order_id)
        return DummyResponse(expected_resp)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    charge = gateway.create_pix_charge(
        order_id=order_id,
        amount_cents=2990,
        description="Pedido live",
    )

    assert charge.id == "pix_char_live_123"
    assert charge.br_code == "00020126580014br.gov.bcb.pix..."
    assert charge.br_code_base64 == "data:image/png;base64,mockqr"
    assert charge.qr_code_url == "https://pay.abacatepay.com/bill-live"
    assert charge.expires_at == datetime(2026, 11, 1, 15, 30, tzinfo=UTC)


def test_abacatepay_gateway_live_call_fallback_expires_at(monkeypatch: pytest.MonkeyPatch) -> None:
    order_id = uuid.uuid4()
    expected_resp = {
        "data": {
            "id": "pix_char_fallback",
            "brCode": "000201...",
            "expiresAt": "invalid-date-format",
        }
    }

    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        return DummyResponse(expected_resp)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    charge = gateway.create_pix_charge(
        order_id=order_id,
        amount_cents=1000,
        description="Fallback date",
    )

    assert charge.expires_at is not None


def test_abacatepay_gateway_live_call_missing_expires_at(monkeypatch: pytest.MonkeyPatch) -> None:
    order_id = uuid.uuid4()
    expected_resp = {
        "data": {
            "id": "pix_char_no_expires",
            "brCode": "000201...",
        }
    }

    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        return DummyResponse(expected_resp)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    charge = gateway.create_pix_charge(
        order_id=order_id,
        amount_cents=1000,
        description="No expires",
    )

    assert charge.expires_at is not None


def test_abacatepay_gateway_live_call_raises_processing_error_on_network_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        raise urllib.error.URLError("Network unreachable")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    with pytest.raises(PaymentProcessingError) as exc_info:
        gateway.create_pix_charge(order_id=uuid.uuid4(), amount_cents=1000, description="Fail")

    assert "Falha na comunicação com Abacate Pay" in str(exc_info.value)


@pytest.mark.parametrize(
    ("api_status", "expected_enum"),
    [
        ("PAID", PaymentStatus.PAID),
        ("COMPLETED", PaymentStatus.PAID),
        ("FAILED", PaymentStatus.FAILED),
        ("CANCELED", PaymentStatus.FAILED),
        ("EXPIRED", PaymentStatus.EXPIRED),
        ("WAITING_PAYMENT", PaymentStatus.PENDING),
    ],
)
def test_abacatepay_gateway_get_payment_status(
    monkeypatch: pytest.MonkeyPatch, api_status: str, expected_enum: PaymentStatus
) -> None:
    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        assert req.get_method() == "GET"
        return DummyResponse({"data": {"status": api_status}})

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    assert gateway.get_payment_status("bill_test_123") == expected_enum


def test_abacatepay_gateway_get_payment_status_network_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        raise urllib.error.URLError("Timeout")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    assert gateway.get_payment_status("bill_test_123") == PaymentStatus.PENDING


def test_abacatepay_gateway_verify_webhook_signature() -> None:
    gateway = AbacatePayGateway()
    secret = "wh_secret_super_secure"
    raw_body = b'{"event":"transparent.completed","data":{"status":"PAID"}}'

    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    valid_b64 = base64.b64encode(digest).decode("utf-8")
    valid_hex = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    assert gateway.verify_webhook_signature(raw_body, valid_b64, secret) is True
    assert gateway.verify_webhook_signature(raw_body, valid_hex, secret) is True
    assert gateway.verify_webhook_signature(raw_body, "tampered-sig", secret) is False
    assert gateway.verify_webhook_signature(raw_body, valid_b64, "") is False
    assert gateway.verify_webhook_signature(raw_body, "", secret) is False


def test_abacatepay_gateway_handles_null_data(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(req: urllib.request.Request, timeout: float = 10.0) -> DummyResponse:
        return DummyResponse({"data": None})

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    gateway = AbacatePayGateway(api_key="abc_dev_live_key")
    charge = gateway.create_pix_charge(
        order_id=uuid.uuid4(),
        amount_cents=1000,
        description="Null data",
    )
    assert charge.status == PaymentStatus.PENDING
    assert gateway.get_payment_status("bill_null") == PaymentStatus.PENDING
