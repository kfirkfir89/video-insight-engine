"""Accuracy pipeline for chapter summarization.

Extracted from LLMService to keep the main service focused on
summarization orchestration. Contains:
- Fact extraction (pre-summarization accuracy checklist)
- Block validation (post-summarization accuracy scoring)
- Validation result persistence (MongoDB)
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.services.llm_provider import LLMProvider
from src.dependencies import get_mongo_client
from src.utils.json_parsing import parse_json_response

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Category-specific fact extraction fields (injected into chapter_facts.txt)
CATEGORY_FACT_FIELDS: dict[str, str] = {
    'code': (
        'Also extract these code-specific fields:\n'
        '- code_snippets: All code shown or discussed (with language)\n'
        '- commands: All CLI commands mentioned\n'
        '- packages: All packages, libraries, or frameworks with versions\n'
        '- error_messages: Any error messages discussed\n'
    ),
    'recipe': (
        'Also extract these recipe-specific fields:\n'
        '- ingredients: Every ingredient with exact measurement and unit\n'
        '- temperatures: All cooking temperatures with units\n'
        '- times: All cooking/prep times\n'
        '- equipment: All tools or equipment mentioned\n'
    ),
    'review': (
        'Also extract these review-specific fields:\n'
        '- specs: All product specifications with values\n'
        '- pros: All positive points mentioned\n'
        '- cons: All negative points mentioned\n'
        '- prices: All prices with currency\n'
        '- ratings: Any scores or ratings given\n'
    ),
    'fitness': (
        'Also extract these fitness-specific fields:\n'
        '- exercises: All exercises with sets/reps/duration\n'
        '- rest_periods: All rest periods mentioned\n'
        '- form_cues: All form instructions or technique tips\n'
        '- modifications: All beginner/advanced alternatives\n'
    ),
    'travel': (
        'Also extract these travel-specific fields:\n'
        '- locations: All place names with details\n'
        '- prices: All costs with currency\n'
        '- transport: Transportation methods and costs\n'
        '- hours: Opening hours or time requirements\n'
    ),
    'education': (
        'Also extract these education-specific fields:\n'
        '- definitions: All terms with their definitions\n'
        '- formulas: Any equations or formulas\n'
        '- examples: All worked examples\n'
    ),
    'interview': (
        'Also extract these interview-specific fields:\n'
        '- speakers: All speakers with their credentials\n'
        '- claims: Key claims made with attribution\n'
    ),
    'music': (
        'Also extract these music-specific fields:\n'
        '- lyrics: Notable lyrics quoted\n'
        '- credits: All production/writing credits\n'
        '- genres: Genre classifications mentioned\n'
    ),
    'standard': '',
}


def _load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    return path.read_text()


async def extract_chapter_facts(
    provider: LLMProvider,
    chapter_text: str,
    title: str,
    persona: str = 'standard',
) -> str:
    """Extract structured fact sheet from chapter using fast model.

    Uses Haiku for ~1s latency. The fact sheet becomes an accuracy
    checklist that the main summarization model must satisfy.

    Args:
        provider: LLMProvider instance for making LLM calls
        chapter_text: The transcript text for this chapter
        title: The chapter title
        persona: Content persona for category-specific extraction

    Returns:
        JSON string of extracted facts, or empty string on failure.
    """
    if not chapter_text.strip():
        return ""

    category_fields = CATEGORY_FACT_FIELDS.get(persona, '')
    # Truncate at whitespace boundary to avoid cutting mid-word
    max_len = 5000
    truncated = chapter_text[:max_len]
    if len(chapter_text) > max_len:
        last_space = truncated.rfind(' ')
        if last_space > max_len * 0.8:
            truncated = truncated[:last_space]
    prompt = _load_prompt("chapter_facts").format(
        title=title,
        content=truncated,
        category_fields=category_fields,
    )

    try:
        result = await provider.complete_fast(
            prompt,
            max_tokens=500,
            timeout=10.0,
        )
        parsed = parse_json_response(result)
        if not parsed:
            logger.warning("Fact extraction returned invalid JSON for '%s'", title)
            return ""
        return json.dumps(parsed)
    except Exception as e:
        logger.warning("Fact extraction failed for '%s': %s", title, e)
        return ""


async def validate_chapter_blocks(
    provider: LLMProvider,
    facts: str,
    blocks: list[dict[str, Any]],
    title: str,
) -> dict[str, Any] | None:
    """Validate generated blocks against fact sheet (non-blocking).

    Runs asynchronously after summarization to log accuracy metrics
    without adding latency to the pipeline.

    Args:
        provider: LLMProvider instance for making LLM calls
        facts: JSON fact sheet from extract_chapter_facts()
        blocks: Generated content blocks
        title: Chapter title for logging

    Returns:
        Validation result dict with score, missing_items, renamed_terms,
        or None on failure.
    """
    if not facts or not blocks:
        return None

    # Truncate by block count to ensure valid JSON (not mid-string)
    truncated_blocks = blocks[:10]
    blocks_json = json.dumps(truncated_blocks, indent=2)
    if len(blocks_json) > 3000:
        truncated_blocks = blocks[:5]
        blocks_json = json.dumps(truncated_blocks, indent=2)

    prompt = _load_prompt("chapter_validate").format(
        fact_sheet=facts,
        blocks_json=blocks_json,
    )

    try:
        result_text = await provider.complete_fast(
            prompt,
            max_tokens=300,
            timeout=10.0,
        )
        result = parse_json_response(result_text)
        if not result:
            logger.warning("Validation returned empty/invalid JSON for '%s'", title[:50])
            return None
        score = result.get("score", 0)
        logger.info(
            "Chapter validation for '%s': score=%d, missing=%d, renamed=%d",
            title[:50],
            score,
            len(result.get("missing_items", [])),
            len(result.get("renamed_terms", [])),
        )
        await _store_validation_result(title, result)
        return result
    except Exception as e:
        logger.warning("Validation failed for '%s': %s", title, e)
        return None


async def _store_validation_result(title: str, result: dict[str, Any]) -> None:
    """Persist validation result to MongoDB for accuracy metrics dashboard.

    Uses asyncio.to_thread() to avoid blocking the event loop with the
    synchronous pymongo client. Failures are logged but never propagated
    — this is a non-critical metrics path.
    """
    def _sync_insert() -> None:
        client = get_mongo_client()
        db = client.get_default_database()
        db.validationResults.insert_one({
            "chapterTitle": title[:100],
            "score": result.get("score", 0),
            "missingItems": result.get("missing_items", []),
            "renamedTerms": result.get("renamed_terms", []),
            "createdAt": datetime.now(timezone.utc),
        })

    try:
        await asyncio.to_thread(_sync_insert)
    except Exception as e:
        logger.warning("Failed to store validation result: %s", e)
