"""Shared data utility functions used across pipeline stages."""

from __future__ import annotations

from typing import Any


def is_empty_data(data: Any) -> bool:
    """Check if resolved data is effectively empty (None or empty collection)."""
    if data is None:
        return True
    if isinstance(data, (list, dict)) and len(data) == 0:
        return True
    return False


def parse_timestamp_to_seconds(raw: Any) -> int | None:
    """Parse a `M:SS` / `MM:SS` / `H:MM:SS` timestamp string into seconds.

    Returns None for malformed, negative, or non-string input so callers can
    skip bad markers. Already-numeric input is coerced to a non-negative int.
    """
    if isinstance(raw, (int, float)):
        return int(raw) if raw >= 0 else None
    if not isinstance(raw, str):
        return None

    parts = raw.strip().split(":")
    if not 2 <= len(parts) <= 3:
        return None

    try:
        values = [int(p) for p in parts]
    except ValueError:
        return None
    if any(v < 0 for v in values):
        return None

    if len(parts) == 2:
        minutes, seconds = values
        total = minutes * 60 + seconds
    else:
        hours, minutes, seconds = values
        total = hours * 3600 + minutes * 60 + seconds
    return total
