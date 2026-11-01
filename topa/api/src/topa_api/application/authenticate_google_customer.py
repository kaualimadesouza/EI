import uuid
from dataclasses import dataclass

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
)
from topa_api.domain.errors import InvalidCustomerDataError


@dataclass(frozen=True)
class GoogleCustomerAuth:
    email: str | None = None
    name: str | None = None
    id_token: str | None = None


class AuthenticateGoogleCustomerUseCase:
    """Authenticates a customer via Google SSO, creating an account on first login."""

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

    def execute(self, auth_data: GoogleCustomerAuth) -> CustomerAuthToken:
        email = (auth_data.email or "").lower().strip()
        name = (auth_data.name or "").strip()

        if not email and auth_data.id_token:
            clean_token = auth_data.id_token.replace("-", "_").lower()
            email = f"google_{clean_token[:12]}@aluno.usp.br"
        if not email or "@" not in email:
            raise InvalidCustomerDataError("E-mail do Google inválido.")

        if not name:
            username = email.split("@")[0].replace(".", " ").title()
            name = f"{username} (Google)"

        record = self._customers.get_by_email(email)
        if record is None:
            customer_id = uuid.uuid4()
            random_secret = uuid.uuid4().hex
            pwd_hash = self._hasher.hash_password(random_secret)
            new_customer = Customer(
                id=customer_id,
                name=name,
                email=email,
                created_at=self._clock.now(),
            )
            self._customers.add(new_customer, pwd_hash)
            authenticated = AuthenticatedCustomer(id=customer_id, name=name, email=email)
        else:
            authenticated = AuthenticatedCustomer(
                id=record.customer.id,
                name=record.customer.name,
                email=record.customer.email,
            )

        token = self._tokens.create_customer_token(authenticated)
        return CustomerAuthToken(
            access_token=token,
            token_type="bearer",
            name=authenticated.name,
            email=authenticated.email,
        )
