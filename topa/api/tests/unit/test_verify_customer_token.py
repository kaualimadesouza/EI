import uuid

import pytest

from tests.fakes import FakeTokenService
from topa_api.application.verify_customer_token import VerifyCustomerTokenUseCase
from topa_api.domain.auth import AuthenticatedCustomer
from topa_api.domain.errors import InvalidTokenError


def test_verifies_valid_customer_token() -> None:
    expected = AuthenticatedCustomer(id=uuid.uuid4(), name="Mariana", email="mari@exemplo.com")
    service = FakeTokenService(valid_customer_tokens={"good-token": expected})
    use_case = VerifyCustomerTokenUseCase(service)

    result = use_case.execute("good-token")

    assert result == expected


def test_refuses_invalid_customer_token() -> None:
    expected = AuthenticatedCustomer(id=uuid.uuid4(), name="Mariana", email="mari@exemplo.com")
    service = FakeTokenService(valid_customer_tokens={"good-token": expected})
    use_case = VerifyCustomerTokenUseCase(service)

    with pytest.raises(InvalidTokenError):
        use_case.execute("bad-token")
