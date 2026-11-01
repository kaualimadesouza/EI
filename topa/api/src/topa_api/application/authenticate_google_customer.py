import uuid
from dataclasses import dataclass

from topa_api.application.ports import (
    Clock,
    CustomerRepositoryPort,
    GoogleTokenVerifierPort,
    PasswordHasherPort,
    TokenServicePort,
)
from topa_api.domain.auth import (
    AuthenticatedCustomer,
    Customer,
    CustomerAuthToken,
)


@dataclass(frozen=True)
class GoogleCustomerAuth:
    id_token: str


class AuthenticateGoogleCustomerUseCase:
    """Authenticates a customer via Google SSO, creating an account on first login."""

    def __init__(
        self,
        customers: CustomerRepositoryPort,
        password_hasher: PasswordHasherPort,
        token_service: TokenServicePort,
        google_verifier: GoogleTokenVerifierPort,
        clock: Clock,
    ) -> None:
        self._customers = customers
        self._hasher = password_hasher
        self._tokens = token_service
        self._verifier = google_verifier
        self._clock = clock

    def execute(self, auth_data: GoogleCustomerAuth) -> CustomerAuthToken:
        identity = self._verifier.verify_id_token(auth_data.id_token)
        email = identity.email.lower().strip()
        name = identity.name.strip()

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
