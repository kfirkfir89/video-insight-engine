"""Synthesis — single call to generate TLDR, takeaways, master summary, SEO."""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from ...config import settings
from ...models.pipeline_types import SynthesisResult
from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from .pipeline_helpers import sanitize_for_prompt

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)
PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "synthesis.txt"


@lru_cache(maxsize=1)
def _load_synthesis_prompt() -> str:
    """Load and cache the synthesis prompt template."""
    return PROMPT_PATH.read_text()


async def synthesize(
    llm_service: LLMService,
    title: str,
    channel: str | None,
    duration: int | None,
    output_type: str,
    extraction_summary: str,
    video_context: str = "",
    language_instruction: str = "",
) -> SynthesisResult:
    """Generate synthesis from extraction data.

    Produces TLDR, key takeaways, master summary, and SEO description.
    """
    prompt_template = _load_synthesis_prompt()
    prompt = (
        prompt_template
        .replace("{title}", sanitize_for_prompt(title))
        .replace("{channel}", sanitize_for_prompt(channel or "Unknown"))
        .replace("{duration_minutes}", str(round(duration / 60)) if duration is not None and duration > 0 else "unknown")
        .replace("{output_type}", output_type)
        .replace("{extraction_summary}", extraction_summary[:4000])
        .replace("{video_context}", video_context or "Not available")
        .replace("{language_instruction}", language_instruction)
    )

    raw = await call_llm_with_retry(
        llm_service, prompt,
        max_tokens=8192, timeout=30.0, max_retries=2,
        stage_name="synthesis", json_mode=True, use_fast_model=True,
        model_override=settings.get_stage_model("synthesis"),
    )
    if not raw:
        raise ValueError("Synthesis LLM call failed after retries")

    logger.debug("Synthesis raw response: %.500s", raw)
    data = parse_json_response(raw)

    if not data:
        raise ValueError("Failed to parse synthesis response from LLM")

    return SynthesisResult.model_validate(data)
