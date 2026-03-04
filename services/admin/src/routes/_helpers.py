"""Shared helpers for admin route modules."""

from datetime import UTC, datetime, timedelta


def cutoff(days: int) -> datetime:
    """Return a UTC datetime ``days`` in the past, for date-range queries.

    Only clamps the minimum to 1.  Callers are expected to validate the
    upper bound (e.g. via ``Query(ge=1, le=MAX_DAYS)``).
    """
    return datetime.now(UTC) - timedelta(days=max(days, 1))
