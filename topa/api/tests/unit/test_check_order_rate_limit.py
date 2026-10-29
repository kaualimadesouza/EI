import pytest

from tests.fakes import FakeRateLimiter
from topa_api.application.check_order_rate_limit import CheckOrderRateLimitUseCase
from topa_api.domain.errors import RateLimitExceededError


def test_allows_requests_within_rate_limit() -> None:
    limiter = FakeRateLimiter(limit=5)
    use_case = CheckOrderRateLimitUseCase(limiter)

    for _ in range(5):
        use_case.execute("192.168.1.10")


def test_rejects_requests_exceeding_rate_limit() -> None:
    limiter = FakeRateLimiter(limit=3, retry_after=45)
    use_case = CheckOrderRateLimitUseCase(limiter)

    for _ in range(3):
        use_case.execute("192.168.1.10")

    with pytest.raises(RateLimitExceededError) as exc_info:
        use_case.execute("192.168.1.10")

    assert exc_info.value.retry_after == 45
