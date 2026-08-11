"""In-memory override state for changing detected category during pipeline processing.

Override state is ephemeral by design:
- Only relevant during active processing
- Cleaned up after pipeline completes
- If process restarts, pipeline restarts from scratch anyway

This module owns the state. The route layer (routes/override.py) handles HTTP
concerns; service/pipeline code imports from here directly.
"""

import logging

logger = logging.getLogger(__name__)

# In-memory override state keyed by videoSummaryId.
# Safe under asyncio: all reads/writes are synchronous (no await between check-and-set).
_MAX_OVERRIDES = 500
_overrides: dict[str, dict[str, str]] = {}


def set_override(video_summary_id: str, data: dict[str, str]) -> None:
    """Store an override for an active pipeline.

    Handles capacity eviction and refreshes insertion order for
    replaced keys so FIFO eviction stays correct.
    """
    # Delete-and-reinsert to refresh insertion order for replaced keys
    _overrides.pop(video_summary_id, None)

    if len(_overrides) >= _MAX_OVERRIDES:
        oldest_key = next(iter(_overrides))
        _overrides.pop(oldest_key, None)
        logger.warning("Override capacity reached, evicted oldest: %s", oldest_key)

    _overrides[video_summary_id] = data

    logger.info(
        "Override set: video_summary_id=%s category=%s persona=%s output_type=%s",
        video_summary_id,
        data.get("category"),
        data.get("persona"),
        data.get("output_type"),
    )


def check_override(video_summary_id: str) -> dict[str, str] | None:
    """Check if an override exists for the given pipeline.

    Returns:
        Override dict with category/persona/output_type, or None.
    """
    return _overrides.get(video_summary_id)


def clear_override(video_summary_id: str) -> None:
    """Clean up override state after pipeline completes."""
    removed = _overrides.pop(video_summary_id, None)
    if removed:
        logger.info("Override cleared: video_summary_id=%s", video_summary_id)
