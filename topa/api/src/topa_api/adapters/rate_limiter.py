import math
import time
from collections.abc import Callable

from topa_api.domain.errors import RateLimitExceededError


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter per key."""

    def __init__(
        self,
        limit: int = 10,
        window_seconds: int = 60,
        time_provider: Callable[[], float] | None = None,
    ) -> None:
        self._limit = limit
        self._window = float(window_seconds)
        self._time = time_provider if time_provider is not None else time.monotonic
        self._records: dict[str, list[float]] = {}

    def check_rate_limit(self, key: str) -> None:
        now = self._time()
        cutoff = now - self._window
        timestamps = [t for t in self._records.get(key, []) if t > cutoff]

        if len(timestamps) >= self._limit:
            oldest = timestamps[0]
            retry_after = max(1, math.ceil(self._window - (now - oldest)))
            self._records[key] = timestamps
            raise RateLimitExceededError(retry_after=retry_after)

        timestamps.append(now)
        self._records[key] = timestamps
