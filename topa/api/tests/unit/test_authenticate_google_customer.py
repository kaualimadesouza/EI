import uuid
from datetime import UTC, datetime

import pytest

from tests.fakes import FakeCustomerRepository, FakePasswordHasher, FakeTokenService, FixedClock
from topa_api.application.authenticate_google_customer import (
    AuthenticateGoogleCustomerUseCase,
    GoogleCustomerAuth,
)
from topa_api.domain.auth import Customer
from topa_api.domain.errors import InvalidCustomerDataError


def test_authenticate_google_customer_creates_new_user() -> None:
    now = datetime(2026, 10, 31, 21, 0, tzinfo=UTC)
    clock = FixedClock(now)
    customers = FakeCustomerRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()

    use_case = AuthenticateGoogleCustomerUseCase(customers, hasher, tokens, clock)
    auth = use_case.execute(
        GoogleCustomerAuth(
            email="aluno@usp.br",
            name="Aluno USP",
        )
    )

    assert auth.name == "Aluno USP"
    assert auth.email == "aluno@usp.br"
    assert auth.token_type == "bearer"
    assert len(auth.access_token) > 0

    record = customers.get_by_email("aluno@usp.br")
    assert record is not None
    assert record.customer.name == "Aluno USP"


def test_authenticate_google_customer_existing_user() -> None:
    now = datetime(2026, 10, 31, 21, 0, tzinfo=UTC)
    clock = FixedClock(now)
    customers = FakeCustomerRepository()
    existing_id = uuid.uuid4()
    customers.add(
        Customer(id=existing_id, name="Larissa Lima", email="larissa@usp.br", created_at=now),
        password_hash="existing_hash",
    )
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()

    use_case = AuthenticateGoogleCustomerUseCase(customers, hasher, tokens, clock)
    auth = use_case.execute(
        GoogleCustomerAuth(
            email="larissa@usp.br",
        )
    )

    assert auth.name == "Larissa Lima"
    assert auth.email == "larissa@usp.br"


def test_authenticate_google_customer_with_token_derives_email_and_name() -> None:
    now = datetime(2026, 10, 31, 21, 0, tzinfo=UTC)
    clock = FixedClock(now)
    customers = FakeCustomerRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()

    use_case = AuthenticateGoogleCustomerUseCase(customers, hasher, tokens, clock)
    auth = use_case.execute(
        GoogleCustomerAuth(
            id_token="google-token-abcdef123",
        )
    )

    assert auth.email.startswith("google_")
    assert "Google" in auth.name


def test_authenticate_google_customer_rejects_empty_email() -> None:
    now = datetime(2026, 10, 31, 21, 0, tzinfo=UTC)
    clock = FixedClock(now)
    customers = FakeCustomerRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()

    use_case = AuthenticateGoogleCustomerUseCase(customers, hasher, tokens, clock)
    with pytest.raises(InvalidCustomerDataError):
        use_case.execute(GoogleCustomerAuth(email="invalid-email"))
