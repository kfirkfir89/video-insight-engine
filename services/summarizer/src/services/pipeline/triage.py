"""Triage pipeline stage — determines content domains, modifiers, and tab layout."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from ...models.domain_types import VALID_CONTENT_TAGS, VALID_MODIFIERS
from ...utils.json_parsing import parse_json_response

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "triage.txt"

CONFIDENCE_THRESHOLD = 0.6


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


# ---------------------------------------------------------------------------
# Category → Content Tag mapping
# ---------------------------------------------------------------------------
# category_rules.json detects 11 categories (cooking, coding, fitness, travel,
# education, podcast, reviews, gaming, diy, music, default) using weighted
# keyword/title/channel scoring. This dict translates those to the 8 triage
# contentTags before injecting into the prompt.

CATEGORY_TO_TAG: dict[str, str] = {
    "cooking": "food",
    "coding": "tech",
    "education": "learning",
    "podcast": "learning",
    "reviews": "review",
    "gaming": "tech",
    "diy": "project",
    "fitness": "fitness",
    "travel": "travel",
    "music": "music",
    "default": "learning",
    "standard": "learning",
}

# Broader keyword-level fallback (used in _build_fallback when LLM fails)
_CATEGORY_FALLBACK: dict[str, str] = {
    **CATEGORY_TO_TAG,
    "recipe": "food",
    "code": "tech",
    "programming": "tech",
    "tutorial": "tech",
    "study": "learning",
    "lecture": "learning",
    "workout": "fitness",
    "exercise": "fitness",
    "review": "review",
    "craft": "project",
}


# ---------------------------------------------------------------------------
# Tab defaults — slim lookup tables
# ---------------------------------------------------------------------------
# _TAB_META: every known tab ID → (default_label, emoji).
# Single source of truth for tab metadata. Also usable as a validation set
# to verify LLM-returned tab IDs are real.

_TAB_META: dict[str, tuple[str, str]] = {
    # learning
    "key_points":  ("Key Points", "💡"),
    "concepts":    ("Concepts", "📚"),
    "takeaways":   ("Takeaways", "🎯"),
    "timestamps":  ("Timestamps", "🕐"),
    "quizzes":     ("Quiz", "🧪"),
    "flashcards":  ("Flash Cards", "📇"),
    "scenarios":   ("Scenarios", "🎯"),
    # travel
    "itinerary":   ("Itinerary", "📅"),
    "budget":      ("Budget", "💰"),
    "packing":     ("Pack List", "🎒"),
    # food
    "ingredients": ("Ingredients", "🛒"),
    "steps":       ("Steps", "📝"),
    "tips":        ("Tips", "💡"),
    # tech
    "overview":    ("Overview", "📋"),
    "code":        ("Code", "💻"),
    "setup":       ("Setup", "⚙️"),
    "patterns":    ("Patterns", "🧩"),
    "cheat_sheet": ("Cheat Sheet", "📋"),
    # fitness
    "exercises":   ("Exercises", "🏋️"),
    "timer":       ("Timer", "⏱️"),
    # music
    "analysis":    ("Analysis", "🎼"),
    "structure":   ("Structure", "🎵"),
    "credits":     ("Credits", "🎤"),
    "lyrics":      ("Lyrics", "🎤"),
    # review
    "verdict":     ("Verdict", "🏆"),
    "pros_cons":   ("Pros & Cons", "⚖️"),
    "specs":       ("Specs", "📊"),
    # project
    "materials":   ("Materials", "🛒"),
    "tools":       ("Tools", "🔧"),
    "safety":      ("Safety", "⚠️"),
    # narrative
    "key_moments": ("Key Moments", "⭐"),
    "quotes":      ("Quotes", "💬"),
}

# Default tab IDs per primary content tag (used when LLM fails or returns empty tabs)
_DEFAULT_TAB_IDS: dict[str, list[str]] = {
    "learning": ["key_points", "concepts", "takeaways", "timestamps"],
    "travel":   ["itinerary", "budget", "packing"],
    "food":     ["ingredients", "steps", "tips"],
    "tech":     ["code", "setup", "patterns"],
    "fitness":  ["exercises", "timer", "tips"],
    "music":    ["analysis", "structure", "credits"],
    "review":   ["verdict", "pros_cons", "specs"],
    "project":  ["steps", "materials", "safety"],
}


def _build_fallback_tabs(primary_tag: str) -> list[dict]:
    """Build default tabs for a primary tag from the slim lookup tables."""
    ids = _DEFAULT_TAB_IDS.get(primary_tag, _DEFAULT_TAB_IDS["learning"])
    return [
        {
            "id": tid,
            "label": _TAB_META[tid][0],
            "emoji": _TAB_META[tid][1],
            "dataSource": f"{primary_tag}.{tid}",
        }
        for tid in ids
    ]


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
    return _CATEGORY_FALLBACK.get(category.lower(), category)


def _build_fallback(category_hint: str | None = None) -> TriageResult:
    """Build a fallback TriageResult when LLM fails or confidence is low."""
    primary = "learning"
    if category_hint:
        primary = _CATEGORY_FALLBACK.get(category_hint.lower(), "learning")

    return TriageResult(
        content_tags=[primary],
        modifiers=[],
        primary_tag=primary,
        user_goal="General summary of the video content",
        tabs=_build_fallback_tabs(primary),
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

    # Ensure tabs have required fields
    valid_tabs = []
    for tab in tabs:
        if isinstance(tab, dict) and "id" in tab and "label" in tab:
            valid_tabs.append({
                "id": tab["id"],
                "label": tab["label"],
                "emoji": tab.get("emoji", ""),
                "dataSource": tab.get("dataSource", ""),
            })
    tabs = valid_tabs

    # Fall back to default tabs if LLM returned none
    if not tabs:
        tabs = _build_fallback_tabs(primary_tag)

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
    transcript_preview: str,
    category_hint: str | None,
    llm_service: LLMService,
    manifest_text: str | None = None,
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
    content_analysis = manifest_text or transcript_preview[:2000]

    prompt = (
        prompt_template
        .replace("{title}", title)
        .replace("{description}", description[:1000] if description else "N/A")
        .replace("{duration_minutes}", str(round(duration / 60)) if duration else "unknown")
        .replace("{category_hint}", normalized_hint or "unknown")
        .replace("{manifest}", content_analysis)
    )

    try:
        raw = await llm_service.call_llm(prompt, max_tokens=4096)
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

    except (ValueError, KeyError, TimeoutError, OSError) as e:
        logger.error("Triage failed: %s — falling back", e)
        return _build_fallback(category_hint)