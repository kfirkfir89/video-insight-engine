"""LLM-based domain + format classifier.

Runs concurrently with manifest in the triage phase. Uses fast model
for low cost (~$0.001) and low latency (2-3s). Falls back to rule-based
category from VideoContext on failure.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from ...config import settings
from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from .pipeline_helpers import sanitize_for_prompt
from .prompt_builder import load_prompt_text

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify.txt"
CLASSIFIER_CONFIDENCE_THRESHOLD = 0.6

VALID_DOMAINS: frozenset[str] = frozenset([
    "learning", "tech", "food", "travel", "fitness", "music", "review", "project",
    "language", "science", "podcast", "news", "gaming", "sport",
])

VALID_FORMATS: frozenset[str] = frozenset([
    "tutorial", "commentary", "reaction", "opinion_rant", "motivational",
    "interview", "lecture", "vlog", "documentary", "walkthrough",
    "podcast", "news", "news_commentary", "entertainment",
    "performance", "comparison", "story",
])


@dataclass
class ContentTraits:
    """Structural traits detected in video content."""
    has_steps: bool = False
    has_drills: bool = False
    has_comparison: bool = False
    has_narrative: bool = False
    has_code: bool = False
    has_visual_demo: bool = False
    is_opinionated: bool = False
    is_list: bool = False

    @classmethod
    def from_dict(cls, data: Any) -> ContentTraits:
        """Parse traits from LLM JSON, with bool() coercion and defaults."""
        if not data or not isinstance(data, dict):
            return cls()
        return cls(
            has_steps=bool(data.get("has_steps", False)),
            has_drills=bool(data.get("has_drills", False)),
            has_comparison=bool(data.get("has_comparison", False)),
            has_narrative=bool(data.get("has_narrative", False)),
            has_code=bool(data.get("has_code", False)),
            has_visual_demo=bool(data.get("has_visual_demo", False)),
            is_opinionated=bool(data.get("is_opinionated", False)),
            is_list=bool(data.get("is_list", False)),
        )

    def active_traits(self) -> list[str]:
        """Return list of trait names that are True."""
        return [
            name for name in [
                "has_steps", "has_drills", "has_comparison", "has_narrative",
                "has_code", "has_visual_demo", "is_opinionated", "is_list",
            ]
            if getattr(self, name)
        ]


@dataclass
class ClassificationResult:
    """Result of the LLM domain+format classifier."""

    domain: str
    format: str
    confidence: float
    reasoning: str
    traits: ContentTraits | None = None


def _load_classify_prompt() -> str:
    """Registry-first classifier prompt. Records version on the active trace."""
    return load_prompt_text(PROMPT_PATH)


async def classify_domain_format(
    title: str,
    channel: str,
    duration: int,
    tags: list[str],
    transcript_preview: str,
    llm_service: LLMService,
) -> ClassificationResult | None:
    """Classify video domain and format using fast LLM.

    Args:
        title: Video title.
        channel: Channel name.
        duration: Duration in seconds.
        tags: Video tags (first 15 used).
        transcript_preview: First ~2000 chars of cleaned transcript.
        llm_service: LLM service instance.

    Returns:
        ClassificationResult on success, None on failure.
    """
    try:
        prompt_template = _load_classify_prompt()
    except FileNotFoundError:
        logger.warning("Classify prompt not found at %s", PROMPT_PATH)
        return None

    tags_str = ", ".join(tags[:15]) if tags else "none"
    duration_minutes = str(round(duration / 60)) if duration > 0 else "unknown"

    prompt = (
        prompt_template
        .replace("{title}", sanitize_for_prompt(title[:200]))
        .replace("{channel}", sanitize_for_prompt(channel[:100] if channel else "Unknown"))
        .replace("{duration_minutes}", duration_minutes)
        .replace("{tags}", sanitize_for_prompt(tags_str, max_len=500))
        .replace("{transcript_preview}", sanitize_for_prompt(transcript_preview[:2000], max_len=2000))
    )

    raw = await call_llm_with_retry(
        llm_service, prompt,
        max_tokens=250, timeout=10.0, max_retries=1,
        stage_name="classifier", json_mode=True,
        use_fast_model=True,
        model_override=settings.get_stage_model("classifier"),
    )

    if not raw:
        return None

    data = parse_json_response(raw)
    if not data:
        logger.warning("Classifier returned unparseable response: %.200s", raw)
        return None

    domain = data.get("domain", "").strip().lower()
    fmt = data.get("format", "").strip().lower()

    confidence = 0.0
    try:
        confidence = max(0.0, min(1.0, float(data.get("confidence", 0))))
    except (TypeError, ValueError):
        pass

    if domain not in VALID_DOMAINS:
        logger.warning("Classifier returned invalid domain '%s'", domain)
        return None

    if fmt not in VALID_FORMATS:
        logger.info("Classifier returned invalid format '%s', defaulting to 'commentary'", fmt)
        fmt = "commentary"

    # Parse traits
    traits_data = data.get("traits", {})
    traits = ContentTraits.from_dict(traits_data) if traits_data else None

    return ClassificationResult(
        domain=domain,
        format=fmt,
        confidence=confidence,
        reasoning=data.get("reasoning", ""),
        traits=traits,
    )
