import base64
import hashlib
import hmac
import http.client
import json
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime, timedelta

from topa_api.application.ports import PaymentGatewayPort
from topa_api.domain.errors import PaymentProcessingError
from topa_api.domain.payment import PaymentStatus, PixCharge


class AbacatePayGateway(PaymentGatewayPort):
    """Integrates with Abacate Pay API for Pix charges and webhook signature verification."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.abacatepay.com",
        timeout_seconds: float = 10.0,
    ) -> None:
        self._api_key = (api_key or "").strip() or None
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    def create_pix_charge(
        self,
        order_id: uuid.UUID,
        amount_cents: int,
        description: str,
        customer_email: str | None = None,
        customer_name: str | None = None,
    ) -> PixCharge:
        now = datetime.now(UTC)
        if not self._api_key or self._api_key.startswith("mock:"):
            charge_id = f"pix_char_{order_id.hex[:12]}"
            br_code = (
                f"00020126580014br.gov.bcb.pix0136{order_id}52040000"
                f"5303986540{amount_cents / 100:.2f}5802BR5904TOPA6009SAO_PAULO62070503***6304"
            )
            return PixCharge(
                id=charge_id,
                order_id=order_id,
                amount_cents=amount_cents,
                status=PaymentStatus.PENDING,
                br_code=br_code,
                br_code_base64=None,
                qr_code_url=f"https://pay.abacatepay.com/bill-{charge_id}",
                expires_at=now + timedelta(minutes=15),
                created_at=now,
            )

        payload = {
            "method": "PIX",
            "data": {
                "amount": amount_cents,
                "externalId": str(order_id),
                "description": description,
            },
        }
        req = urllib.request.Request(
            f"{self._base_url}/v2/transparents/create",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "User-Agent": "TOPA-API/0.1.6",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw_data = json.loads(resp.read().decode("utf-8")).get("data")
                data = raw_data if isinstance(raw_data, dict) else {}
                expires_at = None
                if data.get("expiresAt"):
                    try:
                        expires_at = datetime.fromisoformat(
                            data["expiresAt"].replace("Z", "+00:00")
                        )
                    except ValueError:
                        expires_at = now + timedelta(minutes=15)
                return PixCharge(
                    id=str(data.get("id", f"pix_{order_id.hex[:12]}")),
                    order_id=order_id,
                    amount_cents=amount_cents,
                    status=PaymentStatus.PENDING,
                    br_code=str(data.get("brCode", "")),
                    br_code_base64=data.get("brCodeBase64"),
                    qr_code_url=data.get("url"),
                    expires_at=expires_at or (now + timedelta(minutes=15)),
                    created_at=now,
                )
        except (
            urllib.error.URLError,
            http.client.HTTPException,
            TimeoutError,
            json.JSONDecodeError,
            KeyError,
        ) as exc:
            raise PaymentProcessingError("Falha na comunicação com Abacate Pay.") from exc

    def get_payment_status(self, payment_id: str) -> PaymentStatus:
        if not self._api_key or self._api_key.startswith("mock:"):
            return PaymentStatus.PENDING

        req = urllib.request.Request(
            f"{self._base_url}/v2/transparents/{payment_id}",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "User-Agent": "TOPA-API/0.1.6",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw_data = json.loads(resp.read().decode("utf-8")).get("data")
                data = raw_data if isinstance(raw_data, dict) else {}
                status_raw = str(data.get("status", "PENDING")).upper()
                if status_raw in ("PAID", "COMPLETED"):
                    return PaymentStatus.PAID
                if status_raw in ("FAILED", "CANCELED", "REFUNDED"):
                    return PaymentStatus.FAILED
                if status_raw == "EXPIRED":
                    return PaymentStatus.EXPIRED
                return PaymentStatus.PENDING
        except (
            urllib.error.URLError,
            http.client.HTTPException,
            TimeoutError,
            json.JSONDecodeError,
        ):
            return PaymentStatus.PENDING

    def verify_webhook_signature(
        self,
        raw_body: bytes,
        signature: str,
        secret: str,
    ) -> bool:
        if not signature or not secret:
            return False
        expected_digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
        expected_b64 = base64.b64encode(expected_digest).decode("utf-8")
        expected_hex = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_b64, signature) or hmac.compare_digest(
            expected_hex, signature
        )
