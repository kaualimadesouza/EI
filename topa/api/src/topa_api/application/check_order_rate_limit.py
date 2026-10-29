from topa_api.application.ports import RateLimiterPort


class CheckOrderRateLimitUseCase:
    """Guards order placement against request floods from the same client."""

    def __init__(self, rate_limiter: RateLimiterPort) -> None:
        self._limiter = rate_limiter

    def execute(self, client_key: str) -> None:
        self._limiter.check_rate_limit(client_key)
