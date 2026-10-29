import pytest

from topa_api.adapters.rate_limiter import InMemoryRateLimiter
from topa_api.domain.errors import RateLimitExceededError


class MonotonicClock:
    def __init__(self, start: float = 1000.0) -> None:
        self.time = start

    def __call__(self) -> float:
        return self.time


def test_allows_requests_within_configured_limit() -> None:
    clock = MonotonicClock(100.0)
    limiter = InMemoryRateLimiter(limit=3, window_seconds=60, time_provider=clock)

    limiter.check_rate_limit("192.168.1.1")
    limiter.check_rate_limit("192.168.1.1")
    limiter.check_rate_limit("192.168.1.1")


def test_blocks_and_computes_retry_after_when_exceeded() -> None:
    clock = MonotonicClock(100.0)
    limiter = InMemoryRateLimiter(limit=2, window_seconds=60, time_provider=clock)

    limiter.check_rate_limit("192.168.1.1")
    clock.time = 110.0
    limiter.check_rate_limit("192.168.1.1")

    clock.time = 120.0
    with pytest.raises(RateLimitExceededError) as exc_info:
        limiter.check_rate_limit("192.168.1.1")

    # Request at 100.0 with 60.0 window expires at 160.0. Current 120.0 -> retry_after 40
    assert exc_info.value.retry_after == 40


def test_slides_window_and_reclaims_budget() -> None:
    clock = MonotonicClock(100.0)
    limiter = InMemoryRateLimiter(limit=2, window_seconds=60, time_provider=clock)

    limiter.check_rate_limit("192.168.1.1")
    limiter.check_rate_limit("192.168.1.1")

    # Advance beyond window for first request
    clock.time = 161.0
    limiter.check_rate_limit("192.168.1.1")


def test_keeps_keys_isolated() -> None:
    clock = MonotonicClock(100.0)
    limiter = InMemoryRateLimiter(limit=1, window_seconds=60, time_provider=clock)

    limiter.check_rate_limit("client-a")
    with pytest.raises(RateLimitExceededError):
        limiter.check_rate_limit("client-a")

    # client-b is still allowed
    limiter.check_rate_limit("client-b")
