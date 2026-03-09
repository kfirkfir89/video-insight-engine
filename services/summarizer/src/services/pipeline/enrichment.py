"""Enrichment — quiz, flashcards, cheat sheet generation for eligible output types."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from ...models.output_types import EnrichmentData
from ...utils.json_parsing import parse_json_response
from .pipeline_helpers import truncate_json_safely

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

# Only certain output types get enrichment
ENRICHMENT_MAP: dict[str, str] = {
    "study_kit": "enrich_study.txt",
    "code_walkthrough": "enrich_code.txt",
}


async def enrich(
    llm_service: LLMService,
    output_type: str,
    extraction_data: dict,
    title: str,
) -> EnrichmentData | None:
    """Generate enrichment content based on output type.

    Returns None for output types that don't support enrichment.
    Returns None on failure (enrichment is non-critical).
    """
    prompt_file_name = ENRICHMENT_MAP.get(output_type)
    if not prompt_file_name:
        return None

    prompt_path = PROMPTS_DIR / prompt_file_name
    if not prompt_path.exists():
        logger.warning("Enrichment prompt not found: %s", prompt_path)
        return None

    try:
        prompt_template = prompt_path.read_text()

        # Truncate extraction data to fit in context at a structural boundary
        extraction_str = truncate_json_safely(extraction_data, 3000)

        prompt = (
            prompt_template
            .replace("{title}", title)
            .replace("{extraction_data}", extraction_str)
        )

        raw = await llm_service.call_llm(prompt, max_tokens=4096)
        data = parse_json_response(raw)

        if not data:
            logger.warning("Empty enrichment response for %s", output_type)
            return None

        return EnrichmentData.model_validate(data)

    except Exception as e:
        logger.error("Enrichment failed for %s: %s — skipping", output_type, e)
        return None
