from dataclasses import dataclass
from datetime import datetime

from topa_api.application.ports import Clock, TokenService
from topa_api.domain.errors import ExpiredTokenError, InvalidTokenError


@dataclass(frozen=True)
class TotemSessionValidationResult:
    valid: bool
    store_slug: str | None = None
    expires_at: datetime | None = None
    seconds_remaining: int = 0
    reason: str | None = None


class ValidateTotemSessionUseCase:
    """Validates whether a temporary totem link session token is authentic and unexpired."""

    def __init__(self, token_service: TokenService, clock: Clock) -> None:
        self._token_service = token_service
        self._clock = clock

    def execute(
        self, token: str, expected_store_slug: str | None = None
    ) -> TotemSessionValidationResult:
        try:
            session = self._token_service.verify_totem_session_token(token)
            if expected_store_slug and session.store_slug != expected_store_slug:
                return TotemSessionValidationResult(
                    valid=False,
                    store_slug=session.store_slug,
                    reason="store_mismatch",
                )
            now = self._clock.now()
            remaining = max(0, int((session.expires_at - now).total_seconds()))
            return TotemSessionValidationResult(
                valid=True,
                store_slug=session.store_slug,
                expires_at=session.expires_at,
                seconds_remaining=remaining,
            )
        except ExpiredTokenError:
            return TotemSessionValidationResult(
                valid=False,
                reason="expired",
            )
        except InvalidTokenError:
            return TotemSessionValidationResult(
                valid=False,
                reason="invalid",
            )
