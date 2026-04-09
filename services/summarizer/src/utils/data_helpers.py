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
