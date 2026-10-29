from topa_api.application.ports import TokenServicePort
from topa_api.domain.auth import AuthenticatedMerchant


class VerifyMerchantTokenUseCase:
    """Validates an access token and returns the authenticated merchant identity."""

    def __init__(self, token_service: TokenServicePort) -> None:
        self._tokens = token_service

    def execute(self, token: str) -> AuthenticatedMerchant:
        return self._tokens.verify_token(token)
