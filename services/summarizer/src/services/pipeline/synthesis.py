"""Synthesis — single call to generate TLDR, takeaways, master summary, SEO."""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from ...models.pipeline_types import SynthesisResult
from ...utils.json_parsing import parse_json_response

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
) -> SynthesisResult:
    """Generate synthesis from extraction data.

    Produces TLDR, key takeaways, master summary, and SEO description.
    """
    prompt_template = _load_synthesis_prompt()
    prompt = (
        prompt_template
        .replace("{title}", title)
        .replace("{channel}", channel or "Unknown")
        .replace("{duration_minutes}", str(round(duration / 60)) if duration is not None and duration > 0 else "unknown")
        .replace("{output_type}", output_type)
        .replace("{extraction_summary}", extraction_summary[:4000])
    )

    raw = await llm_service.call_llm(prompt, max_tokens=8192)
    logger.debug("Synthesis raw response: %.500s", raw)
    data = parse_json_response(raw)

    if not data:
        raise ValueError("Failed to parse synthesis response from LLM")

    return SynthesisResult.model_validate(data)
