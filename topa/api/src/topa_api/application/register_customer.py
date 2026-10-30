import uuid

from topa_api.application.ports import (
    Clock,
    CustomerRepositoryPort,
    PasswordHasherPort,
    TokenServicePort,
)
from topa_api.domain.auth import (
    AuthenticatedCustomer,
    Customer,
    CustomerAuthToken,
    CustomerRegistration,
)
from topa_api.domain.errors import EmailAlreadyInUseError, InvalidCustomerDataError


class RegisterCustomerUseCase:
    """Validates registration data, stores customer and returns an auth token."""

    def __init__(
        self,
        customers: CustomerRepositoryPort,
        password_hasher: PasswordHasherPort,
        token_service: TokenServicePort,
        clock: Clock,
    ) -> None:
        self._customers = customers
        self._hasher = password_hasher
        self._tokens = token_service
        self._clock = clock

    def execute(self, registration: CustomerRegistration) -> CustomerAuthToken:
        name = registration.name.strip()
        email = registration.email.lower().strip()
        password = registration.password

        if not name:
            raise InvalidCustomerDataError("Nome não pode ser vazio.")
        if not email or "@" not in email or email.startswith("@") or email.endswith("@"):
            raise InvalidCustomerDataError("E-mail inválido.")
        if len(password) < 6:
            raise InvalidCustomerDataError("Senha deve ter no mínimo 6 caracteres.")

        if self._customers.get_by_email(email) is not None:
            raise EmailAlreadyInUseError()

        customer = Customer(
            id=uuid.uuid4(),
            name=name,
            email=email,
            created_at=self._clock.now(),
        )
        password_hash = self._hasher.hash_password(password)
        self._customers.add(customer, password_hash)

        authenticated = AuthenticatedCustomer(
            id=customer.id, name=customer.name, email=customer.email
        )
        token = self._tokens.create_customer_token(authenticated)
        return CustomerAuthToken(
            access_token=token,
            token_type="bearer",
            name=customer.name,
            email=customer.email,
        )
