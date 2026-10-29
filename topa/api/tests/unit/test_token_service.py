import uuid
from datetime import UTC, datetime

import pytest

from tests.fakes import FixedClock
from topa_api.adapters.security.token_service import HmacTokenService
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.domain.errors import InvalidTokenError


def test_creates_and_verifies_valid_token() -> None:
    service = HmacTokenService(secret_key="test-secret-key")
    merchant_id = uuid.uuid4()
    merchant = AuthenticatedMerchant(
        id=merchant_id,
        email="admin@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
    )

    token = service.create_token(merchant)
    verified = service.verify_token(token)

    assert verified.id == merchant_id
    assert verified.email == "admin@bemtevi.topa.com"
    assert verified.store_slug == "lanchonete-bem-te-vi"


def test_rejects_expired_token() -> None:
    now = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)
    clock = FixedClock(now)
    service = HmacTokenService(secret_key="test-secret-key", clock=clock)
    merchant = AuthenticatedMerchant(
        id=uuid.uuid4(),
        email="admin@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
    )

    token = service.create_token(merchant, expires_in_seconds=60)
    clock.moment = datetime(2026, 10, 29, 12, 2, tzinfo=UTC)

    with pytest.raises(InvalidTokenError):
        service.verify_token(token)


def test_rejects_tampered_signature() -> None:
    service = HmacTokenService(secret_key="test-secret-key")
    merchant = AuthenticatedMerchant(
        id=uuid.uuid4(),
        email="admin@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
    )
    token = service.create_token(merchant)
    tampered = token[:-4] + "xxxx"

    with pytest.raises(InvalidTokenError):
        service.verify_token(tampered)


def test_rejects_token_signed_with_different_key() -> None:
    service_a = HmacTokenService(secret_key="key-a")
    service_b = HmacTokenService(secret_key="key-b")
    merchant = AuthenticatedMerchant(
        id=uuid.uuid4(),
        email="admin@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
    )
    token = service_a.create_token(merchant)

    with pytest.raises(InvalidTokenError):
        service_b.verify_token(token)


@pytest.mark.parametrize(
    "malformed_token",
    [
        "not_even_a_dot",
        "too.many.dots.here",
        "invalid_b64.invalid_sig",
    ],
)
def test_rejects_malformed_tokens(malformed_token: str) -> None:
    service = HmacTokenService(secret_key="test-secret-key")

    with pytest.raises(InvalidTokenError):
        service.verify_token(malformed_token)


def test_rejects_payload_with_missing_fields() -> None:
    import base64
    import hashlib
    import hmac

    service = HmacTokenService(secret_key="test-secret-key")
    bad_payload = (
        base64.urlsafe_b64encode(b'{"exp": 9999999999, "email": "a@b.com"}')
        .decode("ascii")
        .rstrip("=")
    )
    sig = hmac.new(b"test-secret-key", bad_payload.encode("ascii"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    bad_token = f"{bad_payload}.{sig_b64}"

    with pytest.raises(InvalidTokenError):
        service.verify_token(bad_token)


def test_rejects_payload_that_is_not_a_json_object() -> None:
    import base64
    import hashlib
    import hmac

    service = HmacTokenService(secret_key="test-secret-key")
    list_payload = base64.urlsafe_b64encode(b"[1, 2, 3]").decode("ascii").rstrip("=")
    sig = hmac.new(b"test-secret-key", list_payload.encode("ascii"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    token = f"{list_payload}.{sig_b64}"

    with pytest.raises(InvalidTokenError):
        service.verify_token(token)
