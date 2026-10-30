import uuid
from datetime import UTC, datetime

import pytest

from tests.fakes import FakeCustomerRepository, FakePasswordHasher, FakeTokenService
from topa_api.application.authenticate_customer import AuthenticateCustomerUseCase
from topa_api.domain.auth import Customer, CustomerCredentials
from topa_api.domain.errors import InvalidCredentialsError


def test_authenticates_customer_with_valid_credentials() -> None:
    repo = FakeCustomerRepository()
    customer = Customer(
        id=uuid.uuid4(),
        name="Carlos Eduardo",
        email="carlos@exemplo.com",
        created_at=datetime.now(UTC),
    )
    repo.add(customer, "hashed_secret123")
    tokens = FakeTokenService()
    use_case = AuthenticateCustomerUseCase(repo, FakePasswordHasher(), tokens)

    token = use_case.execute(CustomerCredentials(email="carlos@exemplo.com", password="secret123"))

    assert token.access_token.startswith("token_for_customer_")
    assert token.email == "carlos@exemplo.com"
    assert token.name == "Carlos Eduardo"


def test_refuses_authentication_when_customer_email_not_found() -> None:
    use_case = AuthenticateCustomerUseCase(
        FakeCustomerRepository(), FakePasswordHasher(), FakeTokenService()
    )

    with pytest.raises(InvalidCredentialsError):
        use_case.execute(CustomerCredentials(email="unknown@exemplo.com", password="secret123"))


def test_refuses_authentication_when_password_does_not_match() -> None:
    repo = FakeCustomerRepository()
    customer = Customer(
        id=uuid.uuid4(),
        name="Carlos Eduardo",
        email="carlos@exemplo.com",
        created_at=datetime.now(UTC),
    )
    repo.add(customer, "hashed_correctpassword")
    use_case = AuthenticateCustomerUseCase(repo, FakePasswordHasher(), FakeTokenService())

    with pytest.raises(InvalidCredentialsError):
        use_case.execute(CustomerCredentials(email="carlos@exemplo.com", password="wrongpassword"))
