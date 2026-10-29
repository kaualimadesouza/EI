from topa_api.application.ports import (
    MerchantRepositoryPort,
    PasswordHasherPort,
    TokenServicePort,
)
from topa_api.domain.auth import AuthenticatedMerchant, AuthToken, Credentials
from topa_api.domain.errors import InvalidCredentialsError


class AuthenticateMerchantUseCase:
    """Verifies merchant credentials and generates an access token."""

    def __init__(
        self,
        merchants: MerchantRepositoryPort,
        password_hasher: PasswordHasherPort,
        token_service: TokenServicePort,
    ) -> None:
        self._merchants = merchants
        self._hasher = password_hasher
        self._tokens = token_service

    def execute(self, credentials: Credentials) -> AuthToken:
        record = self._merchants.get_by_email(credentials.email)
        if record is None:
            raise InvalidCredentialsError()
        if not self._hasher.verify_password(credentials.password, record.password_hash):
            raise InvalidCredentialsError()
        authenticated = AuthenticatedMerchant(
            id=record.merchant.id,
            email=record.merchant.email,
            store_slug=record.merchant.store_slug,
        )
        token = self._tokens.create_token(authenticated)
        return AuthToken(
            access_token=token,
            token_type="bearer",
            store_slug=record.merchant.store_slug,
            email=record.merchant.email,
        )
