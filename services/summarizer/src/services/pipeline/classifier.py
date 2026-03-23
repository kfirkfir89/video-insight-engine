"""LLM-based domain + format classifier.

Runs concurrently with manifest in the triage phase. Uses fast model
for low cost (~$0.001) and low latency (2-3s). Falls back to rule-based
category from VideoContext on failure.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from .pipeline_helpers import sanitize_for_prompt

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify.txt"
CLASSIFIER_CONFIDENCE_THRESHOLD = 0.6

VALID_DOMAINS: frozenset[str] = frozenset([
    "learning", "tech", "food", "travel", "fitness", "music", "review", "project",
])

VALID_FORMATS: frozenset[str] = frozenset([
    "tutorial", "commentary", "reaction", "opinion_rant", "motivational",
    "interview", "lecture", "vlog", "documentary", "walkthrough",
    "podcast", "news", "news_commentary", "entertainment",
    "performance", "comparison", "story",
])


@dataclass
class ClassificationResult:
    """Result of the LLM domain+format classifier."""

    domain: str
    format: str
    confidence: float
    reasoning: str


@lru_cache(maxsize=1)
def _load_classify_prompt() -> str:
    """Load and cache the classify prompt template."""
    return PROMPT_PATH.read_text()


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
        max_tokens=150, timeout=10.0, max_retries=1,
        stage_name="classifier", json_mode=True,
        use_fast_model=True,
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

    return ClassificationResult(
        domain=domain,
        format=fmt,
        confidence=confidence,
        reasoning=data.get("reasoning", ""),
    )
