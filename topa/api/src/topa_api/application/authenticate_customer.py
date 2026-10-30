from topa_api.application.ports import (
    CustomerRepositoryPort,
    PasswordHasherPort,
    TokenServicePort,
)
from topa_api.domain.auth import (
    AuthenticatedCustomer,
    CustomerAuthToken,
    CustomerCredentials,
)
from topa_api.domain.errors import InvalidCredentialsError


class AuthenticateCustomerUseCase:
    """Verifies customer credentials and generates an access token."""

    def __init__(
        self,
        customers: CustomerRepositoryPort,
        password_hasher: PasswordHasherPort,
        token_service: TokenServicePort,
    ) -> None:
        self._customers = customers
        self._hasher = password_hasher
        self._tokens = token_service

    def execute(self, credentials: CustomerCredentials) -> CustomerAuthToken:
        record = self._customers.get_by_email(credentials.email)
        if record is None:
            raise InvalidCredentialsError()
        if not self._hasher.verify_password(credentials.password, record.password_hash):
            raise InvalidCredentialsError()
        authenticated = AuthenticatedCustomer(
            id=record.customer.id,
            name=record.customer.name,
            email=record.customer.email,
        )
        token = self._tokens.create_customer_token(authenticated)
        return CustomerAuthToken(
            access_token=token,
            token_type="bearer",
            name=record.customer.name,
            email=record.customer.email,
        )
