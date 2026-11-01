from datetime import UTC, datetime

from tests.fakes import FixedClock
from topa_api.adapters.security.token_service import HmacTokenService
from topa_api.application.validate_totem_session import ValidateTotemSessionUseCase


def test_validate_totem_session_success() -> None:
    clock = FixedClock(datetime(2026, 10, 31, 20, 0, tzinfo=UTC))
    tokens = HmacTokenService(secret_key="secret", clock=clock)
    token = tokens.create_totem_session_token("brasa-burgers", expires_in_seconds=1800)

    clock.moment = datetime(2026, 10, 31, 20, 10, tzinfo=UTC)
    use_case = ValidateTotemSessionUseCase(tokens, clock)
    result = use_case.execute(token=token, expected_store_slug="brasa-burgers")

    assert result.valid is True
    assert result.store_slug == "brasa-burgers"
    assert result.expires_at == datetime(2026, 10, 31, 20, 30, tzinfo=UTC)
    assert result.seconds_remaining == 1200
    assert result.reason is None


def test_validate_totem_session_mismatched_store() -> None:
    clock = FixedClock(datetime(2026, 10, 31, 20, 0, tzinfo=UTC))
    tokens = HmacTokenService(secret_key="secret", clock=clock)
    token = tokens.create_totem_session_token("brasa-burgers", expires_in_seconds=1800)

    use_case = ValidateTotemSessionUseCase(tokens, clock)
    result = use_case.execute(token=token, expected_store_slug="bella-nonna")

    assert result.valid is False
    assert result.store_slug == "brasa-burgers"
    assert result.reason == "store_mismatch"


def test_validate_totem_session_invalid_token() -> None:
    clock = FixedClock(datetime(2026, 10, 31, 20, 0, tzinfo=UTC))
    tokens = HmacTokenService(secret_key="secret", clock=clock)

    use_case = ValidateTotemSessionUseCase(tokens, clock)
    result = use_case.execute(token="invalid.token")

    assert result.valid is False
    assert result.store_slug is None
    assert result.reason == "invalid_or_expired"
