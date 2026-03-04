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

# Tracks whether generation has started (first chapter_ready emitted) for a pipeline.
# Once generation starts, overrides are rejected — the client must cancel and restart.
_generation_started: dict[str, bool] = {}


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


# ─────────────────────────────────────────────────────────────────────────────
# Generation-started tracking
# ─────────────────────────────────────────────────────────────────────────────


def mark_generation_started(video_summary_id: str) -> None:
    """Mark that generation has started (first chapter_ready emitted).

    Once marked, overrides are rejected for this pipeline — the client
    must cancel and restart to change the detected category.
    """
    _generation_started[video_summary_id] = True
    logger.info("Generation started: video_summary_id=%s", video_summary_id)


def is_generation_started(video_summary_id: str) -> bool:
    """Check if generation has already started for the given pipeline."""
    return _generation_started.get(video_summary_id, False)


def clear_generation_started(video_summary_id: str) -> None:
    """Clean up generation-started state after pipeline completes."""
    _generation_started.pop(video_summary_id, None)
