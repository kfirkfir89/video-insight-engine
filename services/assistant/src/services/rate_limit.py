"""In-memory sliding-window rate limiting for the assistant endpoints.

Bounded TTLCache buckets keyed by upstream user id (with per-endpoint
fallbacks). Single-replica by design — matches the service's deployment
assumption; a shared Redis store would replace this if replicas grow.
"""

from __future__ import annotations

import time

from cachetools import TTLCache

_RATE_LIMIT_MAX: int = 30  # /chat requests per window
_RATE_LIMIT_WINDOW: int = 60  # seconds
_LIBRARY_RATE_LIMIT_MAX: int = 60  # /library/search — cheap, no LLM
_ACTION_RATE_LIMIT_MAX: int = (
    30  # /action — 30 calls per 60s sliding window (≈1 every 2s on average)
)
_rate_tracker = TTLCache[str, list[float]](maxsize=10000, ttl=_RATE_LIMIT_WINDOW * 2)
_library_rate_tracker = TTLCache[str, list[float]](
    maxsize=10000,
    ttl=_RATE_LIMIT_WINDOW * 2,
)
_action_rate_tracker = TTLCache[str, list[float]](
    maxsize=10000,
    ttl=_RATE_LIMIT_WINDOW * 2,
)


def _check_rate_limit(key: str) -> bool:
    """Return True if the chat rate limit is exceeded for *key*."""
    return _check_bucket(_rate_tracker, key, _RATE_LIMIT_MAX)


def _check_library_rate_limit(key: str) -> bool:
    """Return True if the library search rate limit is exceeded for *key*."""
    return _check_bucket(_library_rate_tracker, key, _LIBRARY_RATE_LIMIT_MAX)


def _check_action_rate_limit(key: str) -> bool:
    """Return True if the action rate limit is exceeded for *key*."""
    return _check_bucket(_action_rate_tracker, key, _ACTION_RATE_LIMIT_MAX)


def _check_bucket(tracker: TTLCache, key: str, limit: int) -> bool:
    """Sliding-window rate limit on a TTLCache bucket."""
    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW
    timestamps = [t for t in tracker.get(key, []) if t > window_start]
    if len(timestamps) >= limit:
        tracker[key] = timestamps
        return True
    timestamps.append(now)
    tracker[key] = timestamps
    return False
