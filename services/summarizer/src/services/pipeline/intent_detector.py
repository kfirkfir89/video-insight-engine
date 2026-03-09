"""Intent detection — determines output type from video metadata + transcript preview."""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import ValidationError

from ...models.output_types import IntentResult, OutputSection, OUTPUT_TYPE_VALUES
from ...utils.json_parsing import parse_json_response

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "intent_detect.txt"

# Default sections per output type (must match frontend *Tabs.tsx switch/case values)
_TYPE_SECTIONS: dict[str, list[OutputSection]] = {
    "explanation": [
        OutputSection(id="key_points", label="Key Points", emoji="💡", description="Main ideas and insights"),
        OutputSection(id="concepts", label="Concepts", emoji="📚", description="Key terms explained"),
        OutputSection(id="takeaways", label="Takeaways", emoji="🎯", description="Actionable conclusions"),
        OutputSection(id="timestamps", label="Timestamps", emoji="🕐", description="Key moments timeline"),
    ],
    "recipe": [
        OutputSection(id="overview", label="Overview", emoji="🍳", description="Recipe overview and equipment"),
        OutputSection(id="ingredients", label="Ingredients", emoji="🛒", description="Full ingredient list"),
        OutputSection(id="steps", label="Steps", emoji="👨‍🍳", description="Step-by-step instructions"),
        OutputSection(id="tips", label="Tips", emoji="✨", description="Chef tips and substitutions"),
    ],
    "code_walkthrough": [
        OutputSection(id="overview", label="Overview", emoji="💻", description="Code overview and architecture"),
        OutputSection(id="setup", label="Setup", emoji="⚙️", description="Installation and configuration"),
        OutputSection(id="code", label="Code", emoji="📝", description="Key code snippets"),
        OutputSection(id="patterns", label="Patterns", emoji="🧩", description="Best practices and patterns"),
        OutputSection(id="cheat_sheet", label="Cheat Sheet", emoji="📋", description="Quick reference"),
    ],
    "study_kit": [
        OutputSection(id="overview", label="Overview", emoji="📚", description="Topic overview"),
        OutputSection(id="concepts", label="Concepts", emoji="🧠", description="Key concepts and definitions"),
        OutputSection(id="flashcards", label="Flashcards", emoji="🃏", description="Study flashcards"),
        OutputSection(id="quiz", label="Quiz", emoji="✅", description="Test your understanding"),
    ],
    "trip_planner": [
        OutputSection(id="trip", label="Trip", emoji="✈️", description="Itinerary and destinations"),
        OutputSection(id="budget", label="Budget", emoji="💰", description="Cost breakdown"),
        OutputSection(id="pack", label="Pack", emoji="🎒", description="Packing list"),
    ],
    "workout": [
        OutputSection(id="overview", label="Overview", emoji="💪", description="Workout overview"),
        OutputSection(id="exercises", label="Exercises", emoji="🏋️", description="Exercise list"),
        OutputSection(id="timer", label="Timer", emoji="⏱️", description="Workout timer"),
        OutputSection(id="tips", label="Tips", emoji="💡", description="Form tips and safety"),
    ],
    "verdict": [
        OutputSection(id="overview", label="Overview", emoji="⭐", description="Product overview"),
        OutputSection(id="pros_cons", label="Pros & Cons", emoji="⚖️", description="Detailed pros and cons"),
        OutputSection(id="specs", label="Specs", emoji="📊", description="Specifications and comparisons"),
        OutputSection(id="verdict", label="Verdict", emoji="🏆", description="Final verdict"),
    ],
    "highlights": [
        OutputSection(id="speakers", label="Speakers", emoji="🎙️", description="Speaker profiles"),
        OutputSection(id="highlights", label="Highlights", emoji="✨", description="Key moments and quotes"),
        OutputSection(id="topics", label="Topics", emoji="📋", description="Discussion topics"),
    ],
    "music_guide": [
        OutputSection(id="credits", label="Credits", emoji="🎤", description="Artists and production credits"),
        OutputSection(id="analysis", label="Analysis", emoji="🎼", description="Musical analysis"),
        OutputSection(id="structure", label="Structure", emoji="🎵", description="Song structure breakdown"),
        OutputSection(id="lyrics", label="Lyrics", emoji="📝", description="Key lyrics and themes"),
    ],
    "project_guide": [
        OutputSection(id="overview", label="Overview", emoji="🔨", description="Project overview"),
        OutputSection(id="materials", label="Materials", emoji="🛒", description="Materials list"),
        OutputSection(id="tools", label="Tools", emoji="🔧", description="Required tools"),
        OutputSection(id="steps", label="Steps", emoji="📝", description="Step-by-step guide"),
        OutputSection(id="safety", label="Safety", emoji="⚠️", description="Safety warnings"),
    ],
}
_DEFAULT_SECTIONS = _TYPE_SECTIONS["explanation"]

CONFIDENCE_THRESHOLD = 0.6


def get_canonical_sections(output_type: str) -> list[OutputSection]:
    """Return canonical sections for an output type, matching frontend tab IDs."""
    return list(_TYPE_SECTIONS.get(output_type, _DEFAULT_SECTIONS))


@lru_cache(maxsize=1)
def _load_intent_prompt() -> str:
    """Load and cache the intent detection prompt template."""
    return PROMPT_PATH.read_text()

# Map video context categories/personas to output types for fallback
_CATEGORY_TO_OUTPUT: dict[str, str] = {
    "cooking": "recipe",
    "recipe": "recipe",
    "code": "code_walkthrough",
    "coding": "code_walkthrough",
    "programming": "code_walkthrough",
    "tutorial": "code_walkthrough",
    "education": "study_kit",
    "study": "study_kit",
    "lecture": "study_kit",
    "travel": "trip_planner",
    "fitness": "workout",
    "workout": "workout",
    "exercise": "workout",
    "review": "verdict",
    "reviews": "verdict",
    "podcast": "highlights",
    "interview": "highlights",
    "music": "music_guide",
    "diy": "project_guide",
    "craft": "project_guide",
}


def _build_fallback(output_type: str = "explanation", confidence: float = 0.0) -> IntentResult:
    """Build a fallback IntentResult with type-specific sections."""
    sections = _TYPE_SECTIONS.get(output_type, _DEFAULT_SECTIONS)
    return IntentResult(
        outputType=output_type,
        confidence=confidence,
        userGoal="General summary of the video content",
        sections=list(sections),
    )


def _category_fallback(category_hint: str | None) -> str:
    """Map category hint to output type."""
    if not category_hint:
        return "explanation"
    hint_lower = category_hint.lower()
    return _CATEGORY_TO_OUTPUT.get(hint_lower, "explanation")


async def detect_intent(
    llm_service: LLMService,
    title: str,
    description: str,
    duration: int,
    category_hint: str | None,
    transcript_preview: str,
) -> IntentResult:
    """Detect user goal and output type from video metadata + first 2000 chars of transcript.

    Returns IntentResult with fallback to category-based type on parsing failure.
    Falls back to 'explanation' if confidence < 0.6.
    """
    prompt_template = _load_intent_prompt()
    prompt = (
        prompt_template
        .replace("{title}", title)
        .replace("{description}", description[:1000] if description else "N/A")
        .replace("{duration_minutes}", str(round(duration / 60)) if duration else "unknown")
        .replace("{category_hint}", category_hint or "unknown")
        .replace("{transcript_preview}", transcript_preview[:2000])
    )

    try:
        raw = await llm_service.call_llm(prompt, max_tokens=4096)
        logger.debug("Intent detection raw response (len=%d): %.500s", len(raw), raw)
        data = parse_json_response(raw)

        if not data:
            fallback_type = _category_fallback(category_hint)
            logger.warning("Empty JSON from intent detection, falling back to %s (from category=%s). Raw: %.300s", fallback_type, category_hint, raw[:300])
            return _build_fallback(fallback_type, 0.5)

        result = IntentResult.model_validate(data)

        # Validate output type is known
        if result.output_type not in OUTPUT_TYPE_VALUES:
            logger.warning("Unknown output type %s, using category fallback", result.output_type)
            fallback_type = _category_fallback(category_hint)
            return _build_fallback(fallback_type, result.confidence)

        # Fallback if confidence too low
        if result.confidence < CONFIDENCE_THRESHOLD:
            logger.info("Low confidence (%.2f), falling back to explanation", result.confidence)
            return _build_fallback(confidence=result.confidence)

        # Always use standard sections — LLM section IDs don't match frontend tab components
        result.sections = list(_TYPE_SECTIONS.get(result.output_type, _DEFAULT_SECTIONS))

        return result

    except (ValueError, KeyError, ValidationError, TimeoutError, OSError) as e:
        fallback_type = _category_fallback(category_hint)
        logger.error("Intent detection failed: %s — falling back to %s", e, fallback_type)
        return _build_fallback(fallback_type, 0.4)
