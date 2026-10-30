import uuid
from datetime import UTC, datetime

import pytest

from tests.fakes import FakeCustomerRepository, FakePasswordHasher, FakeTokenService, FixedClock
from topa_api.application.register_customer import RegisterCustomerUseCase
from topa_api.domain.auth import Customer, CustomerRegistration
from topa_api.domain.errors import EmailAlreadyInUseError, InvalidCustomerDataError


def test_registers_new_customer_successfully() -> None:
    repo = FakeCustomerRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    clock = FixedClock(datetime(2026, 10, 30, 12, 0, 0, tzinfo=UTC))
    use_case = RegisterCustomerUseCase(repo, hasher, tokens, clock)

    registration = CustomerRegistration(
        name="Ana Silva",
        email="ana@exemplo.com",
        password="secretpassword",
    )
    result = use_case.execute(registration)

    assert result.email == "ana@exemplo.com"
    assert result.name == "Ana Silva"
    assert result.access_token.startswith("token_for_customer_")
    assert result.token_type == "bearer"
    assert repo.get_by_email("ana@exemplo.com") is not None


def test_refuses_registration_when_email_is_taken() -> None:
    repo = FakeCustomerRepository()
    repo.add(
        Customer(
            id=uuid.uuid4(),
            name="Existing",
            email="ana@exemplo.com",
            created_at=datetime.now(UTC),
        ),
        "existing-hash",
    )
    clock = FixedClock(datetime(2026, 10, 30, 12, 0, 0, tzinfo=UTC))
    use_case = RegisterCustomerUseCase(repo, FakePasswordHasher(), FakeTokenService(), clock)

    with pytest.raises(EmailAlreadyInUseError):
        use_case.execute(
            CustomerRegistration(
                name="Ana Silva",
                email="ana@exemplo.com",
                password="secretpassword",
            )
        )


@pytest.mark.parametrize(
    "name,email,password",
    [
        ("", "ana@exemplo.com", "secretpassword"),
        ("   ", "ana@exemplo.com", "secretpassword"),
        ("Ana", "", "secretpassword"),
        ("Ana", "invalid-email", "secretpassword"),
        ("Ana", "ana@exemplo.com", "short"),
    ],
)
def test_validates_customer_registration_fields(name: str, email: str, password: str) -> None:
    clock = FixedClock(datetime(2026, 10, 30, 12, 0, 0, tzinfo=UTC))
    use_case = RegisterCustomerUseCase(
        FakeCustomerRepository(), FakePasswordHasher(), FakeTokenService(), clock
    )

    with pytest.raises(InvalidCustomerDataError):
        use_case.execute(CustomerRegistration(name=name, email=email, password=password))
