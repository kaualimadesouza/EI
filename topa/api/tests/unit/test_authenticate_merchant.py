import uuid
from datetime import UTC, datetime

import pytest

from tests.fakes import FakeMerchantRepository, FakePasswordHasher, FakeTokenService
from topa_api.application.authenticate_merchant import AuthenticateMerchantUseCase
from topa_api.domain.auth import Credentials, Merchant
from topa_api.domain.errors import InvalidCredentialsError


def test_authenticates_merchant_with_valid_credentials() -> None:
    merchant_id = uuid.uuid4()
    merchant = Merchant(
        id=merchant_id,
        email="admin@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
        created_at=datetime.now(UTC),
    )
    repo = FakeMerchantRepository([merchant], {"admin@bemtevi.topa.com": "hashed_topa123"})
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    use_case = AuthenticateMerchantUseCase(repo, hasher, tokens)

    result = use_case.execute(Credentials(email="admin@bemtevi.topa.com", password="topa123"))

    assert result.access_token == f"token_for_{merchant_id}"
    assert result.token_type == "bearer"
    assert result.store_slug == "lanchonete-bem-te-vi"
    assert result.email == "admin@bemtevi.topa.com"


def test_rejects_unknown_merchant_email() -> None:
    repo = FakeMerchantRepository([], {})
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    use_case = AuthenticateMerchantUseCase(repo, hasher, tokens)

    with pytest.raises(InvalidCredentialsError):
        use_case.execute(Credentials(email="unknown@topa.com", password="topa123"))


def test_rejects_incorrect_password() -> None:
    merchant_id = uuid.uuid4()
    merchant = Merchant(
        id=merchant_id,
        email="admin@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
        created_at=datetime.now(UTC),
    )
    repo = FakeMerchantRepository([merchant], {"admin@bemtevi.topa.com": "hashed_topa123"})
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    use_case = AuthenticateMerchantUseCase(repo, hasher, tokens)

    with pytest.raises(InvalidCredentialsError):
        use_case.execute(Credentials(email="admin@bemtevi.topa.com", password="wrongpassword"))
