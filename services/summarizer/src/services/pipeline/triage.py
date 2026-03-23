"""Triage pipeline stage — determines content domains, modifiers, and tab layout."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from .pipeline_helpers import sanitize_for_prompt
from ...shared_config.domain_config import (
    build_fallback_tabs,
    map_category_to_tag,
    valid_components,
    valid_content_tags,
    valid_modifiers,
)
from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from .assembly import infer_component

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "triage.txt"
COMPONENT_TOOLKIT_PATH = Path(__file__).parent.parent.parent / "prompts" / "component_toolkit.txt"

CONFIDENCE_THRESHOLD = 0.6

VALID_CONTENT_TAGS = valid_content_tags()
VALID_MODIFIERS = valid_modifiers()


@dataclass
class TriageResult:
    """Result of the triage pipeline stage."""

    content_tags: list[str] = field(default_factory=lambda: ["learning"])
    modifiers: list[str] = field(default_factory=list)
    primary_tag: str = "learning"
    user_goal: str = "General summary of the video content"
    tabs: list[dict] = field(default_factory=list)
    confidence: float = 0.0


@lru_cache(maxsize=1)
def _load_triage_prompt() -> str:
    """Load and cache the triage prompt template."""
    return PROMPT_PATH.read_text()


@lru_cache(maxsize=1)
def _load_component_toolkit() -> str:
    """Load and cache the component toolkit reference."""
    if COMPONENT_TOOLKIT_PATH.exists():
        return COMPONENT_TOOLKIT_PATH.read_text()
    logger.warning("Component toolkit not found at %s", COMPONENT_TOOLKIT_PATH)
    return ""


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_tags(tags: list, valid_set: frozenset, max_count: int) -> list[str]:
    """Filter and limit tags to valid values."""
    return [t for t in tags if t in valid_set][:max_count]


def _normalize_category_hint(category: str | None) -> str | None:
    """Map raw category names (e.g. 'cooking', 'coding') to contentTag names."""
    if not category:
        return None
    return map_category_to_tag(category)


def _build_fallback(category_hint: str | None = None) -> TriageResult:
    """Build a fallback TriageResult when LLM fails or confidence is low."""
    primary = "learning"
    if category_hint:
        primary = map_category_to_tag(category_hint)

    tags = [primary]
    if "learning" not in tags:
        tags.append("learning")

    return TriageResult(
        content_tags=tags,
        modifiers=[],
        primary_tag=primary,
        user_goal="General summary of the video content",
        tabs=build_fallback_tabs(primary),
        confidence=0.0,
    )


def _parse_triage_response(data: dict) -> TriageResult:
    """Parse and validate a triage response from LLM output.

    Applies validation:
    - content_tags filtered to valid values, 1-3 items
    - modifiers filtered to valid values, 0-2 items
    - primary_tag must be in content_tags
    - tabs capped at 6
    - confidence clamped to 0.0-1.0
    """
    content_tags = _validate_tags(
        data.get("contentTags", []),
        VALID_CONTENT_TAGS,
        max_count=3,
    )
    modifiers = _validate_tags(
        data.get("modifiers", []),
        VALID_MODIFIERS,
        max_count=2,
    )

    if not content_tags:
        content_tags = ["learning"]

    # Always include learning — every video benefits from keyPoints, concepts,
    # takeaways, and timestamps regardless of primary domain.
    if "learning" not in content_tags:
        content_tags.append("learning")

    primary_tag = data.get("primaryTag", content_tags[0])
    if primary_tag not in content_tags:
        primary_tag = content_tags[0]

    confidence = data.get("confidence", 0.0)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.0

    tabs = data.get("tabs", [])
    if not isinstance(tabs, list):
        tabs = []
    tabs = tabs[:6]

    # Ensure tabs have required fields + validate component
    valid_component_names = valid_components()
    valid_tabs = []
    seen_ids: set[str] = set()
    for tab in tabs:
        if isinstance(tab, dict) and "id" in tab and "label" in tab:
            tid = tab["id"]
            # Validate tab ID is snake_case
            if not re.match(r'^[a-z][a-z0-9_]*$', tid):
                logger.info("Invalid tab ID format '%s', skipping", tid)
                continue
            # Skip duplicate tab IDs
            if tid in seen_ids:
                logger.info("Duplicate tab ID '%s', skipping", tid)
                continue
            seen_ids.add(tid)
            component = tab.get("component", "")
            # Validate component against domains.json components; fallback to inference
            if component and component not in valid_component_names:
                logger.info("Invalid component '%s' for tab '%s', inferring from tab ID", component, tid)
                component = ""
            if not component:
                component = infer_component(tid)
            valid_tabs.append({
                "id": tid,
                "label": tab["label"],
                "emoji": tab.get("emoji", ""),
                "dataSource": tab.get("dataSource", ""),
                "component": component,
                "goal": tab.get("goal", ""),
            })
    tabs = valid_tabs

    # Fall back to default tabs if LLM returned none
    if not tabs:
        tabs = build_fallback_tabs(primary_tag)

    user_goal = data.get("userGoal", "General summary of the video content")
    if not isinstance(user_goal, str) or not user_goal.strip():
        user_goal = "General summary of the video content"

    return TriageResult(
        content_tags=content_tags,
        modifiers=modifiers,
        primary_tag=primary_tag,
        user_goal=user_goal,
        tabs=tabs,
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run_triage(
    title: str,
    description: str,
    duration: int,
    category_hint: str | None,
    llm_service: LLMService,
    manifest_text: str | None = None,
    transcript_preview: str = "",
    content_format: str | None = None,
) -> TriageResult:
    """Run the triage stage to determine content domains and tab layout.

    Args:
        title: Video title.
        description: Video description (truncated to 1000 chars).
        duration: Video duration in seconds.
        transcript_preview: First ~2000 chars of transcript (fallback if no manifest).
        category_hint: Optional category hint from video metadata.
        llm_service: LLM service for the triage call.
        manifest_text: Pre-formatted manifest text (replaces transcript_preview when available).

    Returns:
        TriageResult with content tags, modifiers, tabs, and sections.
        Falls back to learning domain on failure or low confidence.
    """
    normalized_hint = _normalize_category_hint(category_hint)

    try:
        prompt_template = _load_triage_prompt()
    except FileNotFoundError:
        logger.error("Triage prompt not found at %s", PROMPT_PATH)
        return _build_fallback(category_hint)

    # Use manifest if available, fall back to transcript_preview
    content_analysis = manifest_text or (transcript_preview[:2000] if transcript_preview else "")

    component_toolkit = _load_component_toolkit()

    prompt = (
        prompt_template
        .replace("{title}", sanitize_for_prompt(title))
        .replace("{description}", sanitize_for_prompt(description[:1000] if description else "N/A", max_len=1000))
        .replace("{duration_minutes}", str(round(duration / 60)) if duration is not None and duration > 0 else "unknown")
        .replace("{category_hint}", normalized_hint or "unknown")
        .replace("{content_format}", content_format or "unknown")
        .replace("{manifest}", content_analysis)
        .replace("{component_toolkit}", component_toolkit)
    )

    try:
        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=2048, timeout=45.0, max_retries=2, stage_name="triage",
        )
        if not raw:
            logger.warning("Triage LLM call failed after retries, using fallback")
            return _build_fallback(category_hint)

        logger.debug("Triage raw response (len=%d): %.500s", len(raw), raw)
        data = parse_json_response(raw)

        if not data:
            logger.warning("Empty JSON from triage, falling back. Raw: %.300s", raw[:300])
            return _build_fallback(category_hint)

        result = _parse_triage_response(data)

        if result.confidence < CONFIDENCE_THRESHOLD:
            logger.info(
                "Low triage confidence (%.2f), falling back to learning",
                result.confidence,
            )
            fallback = _build_fallback(category_hint)
            fallback.confidence = result.confidence
            return fallback

        return result

    except Exception as e:
        logger.error("Triage failed (%s): %s — falling back", type(e).__name__, e)
        return _build_fallback(category_hint)