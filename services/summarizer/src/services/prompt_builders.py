"""Prompt building utilities for LLM-based video summarization.

Extracted from llm.py to separate prompt construction concerns from the
LLMService class. Contains:
- Pydantic request models (ChapterContext, AccuracyHints, ChapterSummaryRequest)
- Prompt template loading (load_prompt, load_persona, load_examples)
- Chapter prompt construction (build_chapter_prompt and helpers)
- Timestamp/text utilities (seconds_to_timestamp, sanitize_llm_input)
- Title analysis (title_needs_subtitle)
- Block ID injection (inject_block_ids)

Concept processing (dedup, merge, extraction prompts) lives in
``concept_processing.py``.
"""

import logging
import re
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from src.services.concept_processing import (
    # Public concept functions used by build_chapter_prompt
    build_concepts_anchor,
    build_concept_prompt_parts,
    # Re-exported: llm.py imports these from prompt_builders for backward compat.
    # NOTE: concept_processing.py imports validate_timestamp from THIS module,
    # creating a bidirectional dependency. Keep this stable to avoid circular imports.
    normalize_aliases,
    normalize_for_dedup,
    names_are_similar,
    merge_chapter_concepts,
    build_concept_extraction_section,
    build_concept_dicts,
    extract_concept_short_form,
)
from src.services.output_type import get_output_type_label

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
PERSONAS_DIR = PROMPTS_DIR / "personas"
EXAMPLES_DIR = PROMPTS_DIR / "examples"

# Valid persona names - whitelist to prevent path traversal attacks
VALID_PERSONAS: frozenset[str] = frozenset([
    'code', 'recipe', 'interview', 'review', 'standard',
    'fitness', 'travel', 'education', 'music'
])


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


def load_persona(name: str) -> str:
    """Load persona guidelines from file.

    Args:
        name: Persona name ('code', 'recipe', 'interview', 'review', 'standard')

    Returns:
        Persona guidelines text. Falls back to 'standard' if invalid or not found.

    Note:
        Not cached — reads from disk each call so changes in
        volume-mounted prompt files are picked up immediately.
    """
    # Validate against whitelist to prevent path traversal
    if name not in VALID_PERSONAS:
        logger.warning("Invalid persona name '%s', falling back to 'standard'", name)
        name = 'standard'

    path = PERSONAS_DIR / f"{name}.txt"
    if path.exists():
        return path.read_text()
    return (PERSONAS_DIR / "standard.txt").read_text()


def load_examples(name: str) -> str:
    """Load persona-specific JSON examples from file.

    Args:
        name: Persona name ('code', 'recipe', 'interview', 'review', 'standard')

    Returns:
        JSON examples text. Falls back to 'standard' if invalid or not found.

    Note:
        Not cached — reads from disk each call so changes in
        volume-mounted prompt files are picked up immediately.
    """
    # Validate against whitelist to prevent path traversal
    if name not in VALID_PERSONAS:
        logger.warning("Invalid persona name '%s', falling back to 'standard'", name)
        name = 'standard'

    path = EXAMPLES_DIR / f"{name}.txt"
    if path.exists():
        return path.read_text()
    return (EXAMPLES_DIR / "standard.txt").read_text()


def load_persona_system() -> str:
    """Load the unified persona system prompt (Author + Domain Experts).

    Returns:
        Persona system text. Falls back to empty string if file missing.

    Note:
        Not cached — reads from disk each call so changes in
        volume-mounted prompt files are picked up immediately.
    """
    path = PROMPTS_DIR / "persona_system.txt"
    if path.exists():
        return path.read_text()
    logger.warning("persona_system.txt not found, using empty persona context")
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# Timestamp & Text Utilities
# ─────────────────────────────────────────────────────────────────────────────

_TIMESTAMP_RE = re.compile(r"^\d{1,2}:\d{2}(?::\d{2})?$")


def validate_timestamp(ts: Any) -> str | None:
    """Validate a timestamp string against expected formats.

    Valid formats: M:SS, MM:SS, H:MM:SS, HH:MM:SS.

    Args:
        ts: Raw timestamp value from LLM output.

    Returns:
        The timestamp string if valid, None otherwise.
    """
    if not isinstance(ts, str):
        return None
    ts = ts.strip()
    if _TIMESTAMP_RE.match(ts):
        return ts
    return None


def seconds_to_timestamp(seconds: int) -> str:
    """Convert seconds to MM:SS format."""
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def sanitize_llm_input(text: str, max_length: int = 10000) -> str:
    """Sanitize user input before including in LLM prompts.

    Prevents prompt injection by:
    - Truncating to max_length to prevent resource exhaustion
    - Stripping leading/trailing whitespace

    Note: We intentionally don't strip special characters as they may be
    legitimate in titles, descriptions, etc. The LLM prompt templates
    are designed to handle user content safely by placing it in clearly
    delimited sections.

    Args:
        text: User-provided text to sanitize
        max_length: Maximum allowed length (default 10000 chars)

    Returns:
        Sanitized text, truncated if necessary
    """
    if not text:
        return ""
    text = text.strip()
    if len(text) > max_length:
        logger.warning("Input truncated from %d to %d chars", len(text), max_length)
        return text[:max_length]
    return text


# ─────────────────────────────────────────────────────────────────────────────
# Chapter Prompt Builders
# ─────────────────────────────────────────────────────────────────────────────


def build_chapter_time_range(start_seconds: int | None, end_seconds: int | None) -> str:
    """Build chapter time range string for timestamp validation prompt injection."""
    if start_seconds is None or end_seconds is None:
        return ""
    duration_secs = end_seconds - start_seconds
    dur_min = duration_secs // 60
    dur_sec = duration_secs % 60
    return (
        f"CHAPTER TIME RANGE: {seconds_to_timestamp(start_seconds)} - "
        f"{seconds_to_timestamp(end_seconds)} (duration: {dur_min} min {dur_sec} sec)\n"
        f"All timestamps in your output MUST fall within this range. "
        f"Timestamps outside {seconds_to_timestamp(start_seconds)}-{seconds_to_timestamp(end_seconds)} are INVALID."
    )


def build_fact_sheet(facts: str) -> str:
    """Build fact sheet prompt section from extracted facts JSON."""
    if not facts:
        return ""
    return f"\nFACT SHEET (use as accuracy checklist — verify all items are covered):\n{facts}\n"


def build_guest_attribution(guest_names: list[str] | None) -> str:
    """Build guest attribution prompt section."""
    if not guest_names:
        return ""
    names_str = ", ".join(guest_names)
    return (
        f"\nSPEAKER ATTRIBUTION (CRITICAL):\n"
        f"Guests in this video: {names_str}\n"
        f"- MUST use actual name in quote attribution\n"
        f'- NEVER use "Expert Name", "Speaker", "Engineer", "Host"\n'
        f'- If unsure who spoke, use "highlight" variant (no attribution)\n'
    )


def build_diversity_instruction(prev_block_types: list[str] | None) -> str:
    """Build block diversity enforcement prompt section."""
    if not prev_block_types:
        return ""
    types_str = ", ".join(prev_block_types)
    return (
        f"\nBLOCK DIVERSITY ENFORCEMENT:\n"
        f"Previous chapter used: [{types_str}]\n"
        f"- Use at least 1 block type NOT in above list\n"
        f"- Do NOT end with same block type as previous chapter\n"
        f"- If previous used comparison, prefer problem_solution/definition/bullets instead\n"
    )


def build_subtitle_parts(has_creator_title: bool) -> tuple[str, str]:
    """Build extra_instruction and generated_title_field for subtitle generation."""
    if has_creator_title:
        return (
            "Also generate a concise subtitle (5-10 words) that explains WHAT this chapter teaches, "
            "not just what it's about. Good: 'How token refresh prevents session expiry'. "
            "Bad: 'About authentication'. Be specific to the actual content.",
            ',\n  "generatedTitle": "short explanatory title for this chapter"',
        )
    return "", ""


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Request Models
# ─────────────────────────────────────────────────────────────────────────────


class ChapterContext(BaseModel):
    """Metadata about the chapter being summarized."""

    model_config = {"frozen": True}

    title: str = ""
    has_creator_title: bool = False
    persona: str = "standard"
    output_type: str = "summary"
    # Persona name used as fallback hint for view resolution.
    # Accepts persona names (e.g., 'code', 'recipe'), NOT category names ('coding', 'cooking').
    # Maps through PERSONA_CATEGORY_MAP internally in block_postprocessing.resolve_view().
    persona_hint: str | None = None
    start_seconds: int | None = None
    end_seconds: int | None = None


class AccuracyHints(BaseModel):
    """Accuracy pipeline inputs for chapter summarization."""

    model_config = {"frozen": True}

    facts: str = ""
    guest_names: list[str] | None = None
    prev_chapter_block_types: list[str] | None = None


class ChapterSummaryRequest(BaseModel):
    """Parameters for chapter summarization.

    Groups the many parameters needed for summarize_chapter into a
    single structured object to improve readability at call sites.
    """

    model_config = {"frozen": True}

    chapter_text: str
    context: ChapterContext = Field(default_factory=ChapterContext)
    concept_names: list[str] | None = None
    extract_concepts: bool = False
    total_chapters: int | None = None
    already_extracted_names: list[str] | None = None
    accuracy: AccuracyHints = Field(default_factory=AccuracyHints)


# Short critical reminder per output type — persona prompts carry the full instructions
_OUTPUT_TYPE_REMINDERS: dict[str, str] = {
    "recipe": "A missing ingredient or step makes the recipe unusable.",
    "tutorial": "Every step must be reproducible without watching the video.",
    "workout": "Include ALL exercises with sets, reps, and rest periods.",
    "study_guide": "Maintain the teaching progression from simple to complex.",
    "travel_plan": "Include ALL locations, costs, and transport details.",
    "review": "Include ALL pros, cons, and the reviewer's verdict.",
    "podcast_notes": "Attribute ALL statements to the correct speaker.",
    "diy_guide": "Include ALL materials, tools, and safety warnings.",
    "game_guide": "Be specific about game mechanics and strategies.",
    "music_guide": "Include ALL credits and production details.",
}


def build_output_type_framing(output_type: str) -> str:
    """Build output type framing text for prompt injection.

    Provides a short structural reinforcement of the output type.
    Detailed instructions live in the persona prompt files — this
    framing only adds the OUTPUT TYPE label and one critical reminder.

    Args:
        output_type: Output type string (e.g. "recipe", "tutorial").

    Returns:
        Framing text to inject into the prompt, or empty string for "summary".
    """
    if not output_type or output_type == "summary":
        return ""

    label = get_output_type_label(output_type)
    reminder = _OUTPUT_TYPE_REMINDERS.get(output_type, "Create comprehensive, actionable content.")
    return f"OUTPUT TYPE: {label}\n{reminder}"


def build_chapter_prompt(req: ChapterSummaryRequest) -> tuple[str, int]:
    """Build the chapter summary prompt and max_tokens from a ChapterSummaryRequest.

    Shared by summarize_chapter and stream_summarize_chapter to avoid duplication.

    Returns:
        (prompt, max_tokens) tuple.
    """
    extra_instruction, generated_title_field = build_subtitle_parts(req.context.has_creator_title)
    chapter_time_range = build_chapter_time_range(req.context.start_seconds, req.context.end_seconds)
    fact_sheet = build_fact_sheet(req.accuracy.facts)
    guest_attribution = build_guest_attribution(req.accuracy.guest_names)
    diversity_instruction = build_diversity_instruction(req.accuracy.prev_chapter_block_types)
    output_type_framing = build_output_type_framing(req.context.output_type)

    concepts_anchor = build_concepts_anchor(req.concept_names)
    concept_extraction_section, concepts_field, max_tokens = build_concept_prompt_parts(
        req.extract_concepts, req.total_chapters, req.already_extracted_names,
    )

    persona_system = load_persona_system()
    variant_examples = load_examples(req.context.persona)
    accuracy_rules = load_prompt("accuracy_rules")

    prompt = load_prompt("chapter_summary").format(
        title=req.context.title,
        content=req.chapter_text,
        extra_instruction=extra_instruction,
        generated_title_field=generated_title_field,
        persona_system=persona_system,
        variant_examples=variant_examples,
        concepts_anchor=concepts_anchor,
        concept_extraction_section=concept_extraction_section,
        concepts_field=concepts_field,
        chapter_time_range=chapter_time_range,
        accuracy_rules=accuracy_rules,
        fact_sheet=fact_sheet,
        guest_attribution=guest_attribution,
        diversity_instruction=diversity_instruction,
        output_type_framing=output_type_framing,
    )
    return prompt, max_tokens


# ─────────────────────────────────────────────────────────────────────────────
# Title Analysis
# ─────────────────────────────────────────────────────────────────────────────

_VAGUE_TITLE_RE = re.compile(
    r'^(intro|outro|part\s+\d+|chapter\s+\d+|section\s+\d+|'
    r'wrap.?up|conclusion|bonus|q\s*&?\s*a|final\s+thoughts|'
    r'closing|opening|welcome|preface)$',
    re.IGNORECASE,
)


def title_needs_subtitle(title: str) -> bool:
    """Check if a chapter title is too vague and needs a generated subtitle.

    Returns True for vague/short titles like "Intro", "Part 1", "Conclusion".
    Returns False for descriptive titles like "How JWT Authentication Works".

    Args:
        title: Chapter title string.

    Returns:
        True if the title is vague and needs a subtitle.
    """
    stripped = title.strip()
    if not stripped:
        return True
    if _VAGUE_TITLE_RE.match(stripped):
        return True
    # Single-word titles are too vague (e.g., "Setup", "Overview")
    return len(stripped.split()) < 2


# ─────────────────────────────────────────────────────────────────────────────
# Block Utilities
# ─────────────────────────────────────────────────────────────────────────────


def inject_block_ids(blocks: list[dict]) -> list[dict]:
    """Inject unique blockId (UUID) into each content block.

    This provides stable identifiers for memorization and RAG features.

    Args:
        blocks: List of content block dictionaries

    Returns:
        Same blocks with blockId added to each
    """
    for block in blocks:
        if isinstance(block, dict) and "blockId" not in block:
            block["blockId"] = str(uuid.uuid4())
    return blocks
