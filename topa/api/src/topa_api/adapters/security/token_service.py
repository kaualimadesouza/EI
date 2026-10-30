import base64
import hashlib
import hmac
import json
import uuid

from topa_api.adapters.clock import SystemClock
from topa_api.application.ports import Clock
from topa_api.domain.auth import AuthenticatedCustomer, AuthenticatedMerchant
from topa_api.domain.errors import InvalidTokenError


class HmacTokenService:
    """Signs and verifies bearer authentication tokens using HMAC-SHA256."""

    def __init__(self, secret_key: str, clock: Clock | None = None) -> None:
        self._secret = secret_key.encode("utf-8")
        self._clock = clock if clock is not None else SystemClock()

    def create_token(self, merchant: AuthenticatedMerchant, expires_in_seconds: int = 86400) -> str:
        now = int(self._clock.now().timestamp())
        payload = {
            "sub": str(merchant.id),
            "email": merchant.email,
            "store_slug": merchant.store_slug,
            "role": "merchant",
            "iat": now,
            "exp": now + expires_in_seconds,
        }
        return self._sign_payload(payload)

    def verify_token(self, token: str) -> AuthenticatedMerchant:
        data = self._decode_payload(token)
        if "store_slug" not in data or data.get("role") != "merchant":
            raise InvalidTokenError()
        try:
            return AuthenticatedMerchant(
                id=uuid.UUID(str(data["sub"])),
                email=str(data["email"]),
                store_slug=str(data["store_slug"]),
            )
        except (ValueError, KeyError, TypeError, AttributeError):
            raise InvalidTokenError() from None

    def create_customer_token(
        self, customer: AuthenticatedCustomer, expires_in_seconds: int = 86400
    ) -> str:
        now = int(self._clock.now().timestamp())
        payload = {
            "sub": str(customer.id),
            "name": customer.name,
            "email": customer.email,
            "role": "customer",
            "iat": now,
            "exp": now + expires_in_seconds,
        }
        return self._sign_payload(payload)

    def verify_customer_token(self, token: str) -> AuthenticatedCustomer:
        data = self._decode_payload(token)
        if data.get("role") != "customer":
            raise InvalidTokenError()
        try:
            return AuthenticatedCustomer(
                id=uuid.UUID(str(data["sub"])),
                name=str(data["name"]),
                email=str(data["email"]),
            )
        except (ValueError, KeyError, TypeError, AttributeError):
            raise InvalidTokenError() from None

    def _sign_payload(self, payload: dict[str, object]) -> str:
        payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
        signature = hmac.new(self._secret, payload_b64.encode("ascii"), hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
        return f"{payload_b64}.{sig_b64}"

    def _decode_payload(self, token: str) -> dict[str, object]:
        parts = token.split(".")
        if len(parts) != 2:
            raise InvalidTokenError()
        payload_b64, sig_b64 = parts[0], parts[1]

        try:
            expected_sig = hmac.new(
                self._secret, payload_b64.encode("ascii"), hashlib.sha256
            ).digest()
            sig_pad = "=" * (-len(sig_b64) % 4)
            actual_sig = base64.urlsafe_b64decode((sig_b64 + sig_pad).encode("ascii"))
            if not hmac.compare_digest(actual_sig, expected_sig):
                raise InvalidTokenError()

            pay_pad = "=" * (-len(payload_b64) % 4)
            raw_payload = base64.urlsafe_b64decode((payload_b64 + pay_pad).encode("ascii"))
            data = json.loads(raw_payload.decode("utf-8"))
            if not isinstance(data, dict):
                raise InvalidTokenError()
            if data.get("exp", 0) < int(self._clock.now().timestamp()):
                raise InvalidTokenError()
            return data
        except (ValueError, KeyError, TypeError, AttributeError, json.JSONDecodeError):
            raise InvalidTokenError() from None
