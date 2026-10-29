import math
import threading
import time
from collections.abc import Callable

from topa_api.domain.errors import RateLimitExceededError


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter with thread lock and key eviction."""

    def __init__(
        self,
        limit: int = 10,
        window_seconds: int = 60,
        time_provider: Callable[[], float] | None = None,
        max_keys: int = 10_000,
    ) -> None:
        self._limit = limit
        self._window = float(window_seconds)
        self._time = time_provider if time_provider is not None else time.monotonic
        self._max_keys = max_keys
        self._lock = threading.Lock()
        self._records: dict[str, list[float]] = {}
        self._call_count = 0

    def check_rate_limit(self, key: str) -> None:
        with self._lock:
            now = self._time()
            cutoff = now - self._window
            self._call_count += 1
            if self._call_count >= 100 or len(self._records) >= self._max_keys:
                self._call_count = 0
                self._prune(cutoff)

            timestamps = [t for t in self._records.get(key, []) if t > cutoff]

            if len(timestamps) >= self._limit:
                oldest = timestamps[0]
                retry_after = max(1, math.ceil(self._window - (now - oldest)))
                self._records[key] = timestamps
                raise RateLimitExceededError(retry_after=retry_after)

            timestamps.append(now)
            self._records[key] = timestamps
            if len(self._records) > self._max_keys:
                self._prune(cutoff)

    def _prune(self, cutoff: float) -> None:
        """Evicts expired keys and caps memory usage to max_keys."""
        expired = [k for k, ts in self._records.items() if not ts or ts[-1] <= cutoff]
        for k in expired:
            del self._records[k]
        while len(self._records) > self._max_keys:
            oldest_key = next(iter(self._records))
            del self._records[oldest_key]
