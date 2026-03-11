"""Manifest pipeline stage — fast structural transcript scan (pre-triage).

Runs concurrently with description_analysis on the cheapest/fastest model.
Non-blocking: if it fails, pipeline continues without it.
"""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from ...models.pipeline_types import ManifestResult
from ...utils.json_parsing import parse_json_response

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "manifest.txt"
MANIFEST_TIMEOUT_SECONDS = 10


@lru_cache(maxsize=1)
def _load_manifest_prompt() -> str:
    """Load and cache the manifest prompt template."""
    return PROMPT_PATH.read_text()


async def run_manifest(
    title: str,
    duration: int,
    transcript: str,
    llm_service: LLMService,
) -> ManifestResult | None:
    """Run the manifest stage to produce a structural transcript scan.

    Uses the cheapest/fastest LLM model available. Has a hard timeout
    of 10 seconds. Returns None on any failure (non-blocking).

    Args:
        title: Video title.
        duration: Video duration in seconds.
        transcript: Full transcript text.
        llm_service: LLM service for the manifest call.

    Returns:
        ManifestResult with structural data, or None on failure.
    """
    try:
        prompt_template = _load_manifest_prompt()
    except FileNotFoundError:
        logger.warning("Manifest prompt not found at %s", PROMPT_PATH)
        return None

    duration_minutes = round(duration / 60) if duration else 0

    prompt = (
        prompt_template
        .replace("{title}", title)
        .replace("{duration_minutes}", str(duration_minutes))
        .replace("{transcript}", transcript)
    )

    try:
        raw = await asyncio.wait_for(
            llm_service.call_llm(prompt, max_tokens=2048),
            timeout=MANIFEST_TIMEOUT_SECONDS,
        )

        data = parse_json_response(raw)
        if not data:
            logger.warning("Empty manifest response, skipping")
            return None

        return ManifestResult.model_validate(data)

    except asyncio.TimeoutError:
        logger.warning("Manifest timed out after %ds, skipping", MANIFEST_TIMEOUT_SECONDS)
        return None
    except Exception as e:
        logger.warning("Manifest failed (non-critical): %s", e)
        return None


def format_manifest_for_triage(manifest: ManifestResult) -> str:
    """Format a ManifestResult into a human-readable string for triage injection.

    Produces a compact text block that replaces transcript_preview in the triage prompt.
    """
    lines: list[str] = []

    if manifest.summary:
        lines.append(f"Summary: {manifest.summary}")

    if manifest.content_type:
        lines.append(f"Content type: {manifest.content_type}")

    if manifest.main_topics:
        lines.append(f"Topics: {', '.join(manifest.main_topics)}")

    # Item counts (only non-zero)
    counts = manifest.item_counts
    count_parts: list[str] = []
    for field_name in ("steps", "spots", "exercises", "ingredients", "songs", "tips", "products"):
        val = getattr(counts, field_name, 0)
        if val > 0:
            count_parts.append(f"{val} {field_name}")
    if count_parts:
        lines.append(f"Item counts: {', '.join(count_parts)}")

    # Sections
    if manifest.sections:
        section_strs = [f"  - {s.title} ({s.density} density)" for s in manifest.sections]
        lines.append("Sections:\n" + "\n".join(section_strs))

    # Key names
    if manifest.key_names:
        lines.append(f"Key names: {', '.join(manifest.key_names[:10])}")

    # Flags
    flags = manifest.flags
    flag_parts: list[str] = []
    if flags.has_storytelling:
        flag_parts.append("storytelling")
    if flags.has_budget_discussion:
        flag_parts.append("budget discussion")
    if flags.has_code_snippets:
        flag_parts.append("code snippets")
    if flags.has_recipe:
        flag_parts.append("recipe")
    if flags.has_workout:
        flag_parts.append("workout")
    if flags.speaker_count > 1:
        flag_parts.append(f"{flags.speaker_count} speakers")
    if flag_parts:
        lines.append(f"Flags: {', '.join(flag_parts)}")

    return "\n".join(lines)
