import uuid

import pytest

from tests.fakes import FakeTokenService
from topa_api.application.verify_merchant_token import VerifyMerchantTokenUseCase
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.domain.errors import InvalidTokenError


def test_verifies_valid_merchant_token() -> None:
    merchant_id = uuid.uuid4()
    tokens = FakeTokenService(
        valid_tokens={
            "valid_token": AuthenticatedMerchant(
                id=merchant_id,
                email="admin@bemtevi.topa.com",
                store_slug="lanchonete-bem-te-vi",
            )
        }
    )
    use_case = VerifyMerchantTokenUseCase(tokens)

    merchant = use_case.execute("valid_token")

    assert merchant.id == merchant_id
    assert merchant.email == "admin@bemtevi.topa.com"
    assert merchant.store_slug == "lanchonete-bem-te-vi"


def test_rejects_invalid_or_expired_token() -> None:
    tokens = FakeTokenService(valid_tokens={})
    use_case = VerifyMerchantTokenUseCase(tokens)

    with pytest.raises(InvalidTokenError):
        use_case.execute("invalid_or_expired_token")
