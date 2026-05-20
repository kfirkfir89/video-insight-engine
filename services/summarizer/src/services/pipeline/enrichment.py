"""Enrichment — quiz, flashcards, cheat sheet generation for eligible output types."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from ...config import settings
from ...models.pipeline_types import EnrichmentData
from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from .pipeline_helpers import truncate_json_safely, sanitize_for_prompt
from .prompt_builder import load_prompt_text

if TYPE_CHECKING:
    from ...services.llm import LLMService

from ...shared_config.domain_config import get_enrichment_map

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"


def _load_prompt(prompt_path: str) -> str | None:
    """Registry-first enrichment prompt loader. Path-traversal safe.

    Resolves the candidate path and rejects anything outside ``PROMPTS_DIR``.
    Then delegates to :func:`load_prompt_text` which prefers the Langfuse
    registry version and falls back to the on-disk file via the
    process-wide ``_read_file_cached`` cache.
    """
    p = Path(prompt_path).resolve()
    if not p.is_relative_to(PROMPTS_DIR.resolve()):
        logger.error("Prompt path traversal blocked: %s", prompt_path)
        return None
    if not p.exists():
        return None
    return load_prompt_text(p)

# Loaded from domains.json["enrichment"] — maps content tag → prompt filename.
# Only tags listed there trigger the enrichment stage.
ENRICHMENT_MAP: dict[str, str] = get_enrichment_map()


def _is_nonempty(value: Any) -> bool:
    """Check if a single value has substantive content."""
    if isinstance(value, list):
        return len(value) > 0
    if isinstance(value, str):
        return len(value) > 10
    if isinstance(value, dict):
        return any(_is_nonempty(v) for v in value.values())
    return value is not None


def _has_meaningful_data(extraction: dict) -> bool:
    """Check if extraction has any non-empty arrays or non-trivial string values."""
    return any(_is_nonempty(v) for v in extraction.values())


async def enrich(
    llm_service: LLMService,
    primary_tag: str,
    extraction_data: dict,
    title: str,
    content_tags: list[str] | None = None,
    synthesis_data: dict | None = None,
    video_context: str = "",
    tab_goals: str = "",
    language_instruction: str = "",
) -> EnrichmentData | None:
    """Generate enrichment content based on primary content tag.

    Falls back to searching all content_tags when primary has no enrichment mapping.
    When extraction_data is empty, uses synthesis_data as context fallback.
    Returns None for content tags that don't support enrichment.
    Returns None on failure (enrichment is non-critical).
    """
    prompt_file_name = ENRICHMENT_MAP.get(primary_tag)
    if not prompt_file_name and content_tags:
        for tag in content_tags:
            prompt_file_name = ENRICHMENT_MAP.get(tag)
            if prompt_file_name:
                logger.info("Enrichment: primary_tag=%r has no mapping; using tag=%r", primary_tag, tag)
                break
    if not prompt_file_name:
        return None

    prompt_path = PROMPTS_DIR / prompt_file_name
    prompt_template = _load_prompt(str(prompt_path))
    if not prompt_template:
        logger.warning("Enrichment prompt not found: %s", prompt_path)
        return None

    try:

        # Build context: prefer extraction data, fall back to synthesis
        if _has_meaningful_data(extraction_data):
            context = truncate_json_safely(extraction_data, 8000)
        else:
            logger.warning("Extraction data is empty — using synthesis as enrichment context")
            if synthesis_data:
                context = json.dumps({
                    "title": title,
                    "summary": synthesis_data.get("masterSummary", ""),
                    "keyTakeaways": synthesis_data.get("keyTakeaways", []),
                    "tldr": synthesis_data.get("tldr", ""),
                }, indent=2)
            else:
                logger.warning("No synthesis data either — enrichment will have minimal context")
                context = json.dumps({"title": title})

        prompt = (
            prompt_template
            .replace("{title}", sanitize_for_prompt(title))
            .replace("{extraction_data}", context)
            .replace("{video_context}", video_context or "Not available")
            .replace("{tab_goals}", tab_goals or "Not specified")
            .replace("{language_instruction}", language_instruction)
        )

        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=8192, timeout=90.0, max_retries=2, stage_name="enrichment",
            json_mode=True, use_fast_model=True,
            model_override=settings.get_stage_model("enrichment"),
        )
        if not raw:
            logger.warning("Enrichment LLM call failed after retries for %s", primary_tag)
            return None

        data = parse_json_response(raw)

        if not data:
            logger.warning("Empty enrichment response for %s", primary_tag)
            return None

        return EnrichmentData.model_validate(data)

    except (ValueError, json.JSONDecodeError) as e:
        logger.error("Enrichment failed for %s: %s — skipping", primary_tag, e)
        return None
    except Exception as e:
        logger.error("Enrichment unexpected error for %s: %s — skipping", primary_tag, e)
        return None
