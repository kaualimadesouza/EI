from topa_api.application.ports import TokenServicePort
from topa_api.domain.auth import AuthenticatedCustomer


class VerifyCustomerTokenUseCase:
    """Validates an access token and returns the authenticated customer identity."""

    def __init__(self, token_service: TokenServicePort) -> None:
        self._tokens = token_service

    def execute(self, token: str) -> AuthenticatedCustomer:
        return self._tokens.verify_customer_token(token)
