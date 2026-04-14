"""Schema injection system — assembles extraction prompts from base template + domain schemas."""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path

from .pipeline_helpers import sanitize_for_prompt

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"
SCHEMAS_DIR = PROMPTS_DIR / "schemas"
EXAMPLES_DIR = PROMPTS_DIR / "examples"

# Allowed schema names — alphanumeric + underscore only (no path traversal)
_SAFE_NAME_RE = re.compile(r"^[a-z0-9_]+$")


@lru_cache(maxsize=32)
def _load_text(path_str: str) -> str:
    """Load and cache a text file from disk."""
    return Path(path_str).read_text()


def build_tab_goals(triage_tabs: list[dict]) -> str:
    """Format triage tabs into a goal-oriented description for extraction prompt.

    Args:
        triage_tabs: Tab dicts from triage result, each with id, label, component, goal.

    Returns:
        Formatted string describing each tab's purpose for the LLM.
    """
    if not triage_tabs:
        return "Not specified — use your best judgment for tab coverage"
    lines = []
    for tab in triage_tabs:
        label = tab.get("label", tab.get("id", "unknown"))
        component = tab.get("component", "overview")
        goal = tab.get("goal", "")
        lines.append(f"Tab: \"{label}\" ({component}) — {goal}")
    return "\n".join(lines)


def _load_schema(name: str) -> str:
    """Load a domain or modifier schema file.

    Args:
        name: Schema name (e.g., "travel", "food", "narrative").
              Must be alphanumeric + underscore only (no path traversal).

    Returns:
        Schema text content, or empty string if file not found or name invalid.
    """
    if not _SAFE_NAME_RE.match(name):
        logger.warning("Rejected unsafe schema name: %r", name)
        return ""
    schema_path = SCHEMAS_DIR / f"{name}.txt"
    if not schema_path.exists():
        logger.warning("Schema file not found: %s", schema_path)
        return ""
    return _load_text(str(schema_path))


def _load_domain_example(tag: str) -> str:
    """Load a domain example file, falling back to learning.txt if not found.

    Args:
        tag: Domain tag (e.g., "food", "tech"). Must pass _SAFE_NAME_RE.

    Returns:
        Example text content, or learning example as fallback.
    """
    if not _SAFE_NAME_RE.match(tag):
        logger.warning("Rejected unsafe example tag: %r", tag)
        tag = "learning"
    example_path = EXAMPLES_DIR / f"{tag}.txt"
    if not example_path.exists():
        logger.info("No example for domain %r, falling back to learning", tag)
        example_path = EXAMPLES_DIR / "learning.txt"
    if not example_path.exists():
        return "No example available — follow the schema above precisely, filling every field."
    return _load_text(str(example_path))


_EMPHASIS = {
    "food": "PRIORITY: Every ingredient with exact measurement. Steps in order. Temps with units.",
    "tech": "PRIORITY: Every code snippet exactly. Variable names preserved. Commands reproducible.",
    "travel": "PRIORITY: Every location map-searchable. Costs with currency. Transport specific.",
    "fitness": "PRIORITY: Every exercise with sets/reps/rest. Form cues verbatim. Modifications included.",
    "review": "PRIORITY: All pros AND cons. Specs with numbers. Verdict unmodified.",
    "learning": "PRIORITY: All concepts with definitions. Examples preserved. Progression maintained.",
    "music": "PRIORITY: Lyrics exact or omitted. Credits complete. Genre specific.",
    "project": "PRIORITY: All materials with specs. Steps in order. Safety verbatim.",
}


def get_detail_level(duration_seconds: int) -> str:
    """Determine extraction detail level based on video duration."""
    duration_minutes = duration_seconds / 60
    if duration_minutes < 10:
        return "concise"
    elif duration_minutes < 45:
        return "standard"
    else:
        return "detailed"


def get_content_emphasis(primary_tag: str) -> str:
    """Get content emphasis instruction for the primary domain."""
    return _EMPHASIS.get(primary_tag, "Extract the most useful information with precision and completeness.")


def _build_base_template(
    content_tags: list[str],
    modifiers: list[str],
    quality_rules: str,
    title: str = "",
    duration_minutes: int = 0,
    user_goal: str = "",
    tab_goals: str = "",
    detail_level: str = "standard",
    content_emphasis: str = "",
    video_context: str = "",
    language_instruction: str = "",
) -> str:
    """Build extraction prompt with domain schemas injected, {transcript} placeholder intact.

    Loads the base_extraction.txt template, then injects domain schemas for
    each content tag and modifier. Uses .replace() (not .format()) to avoid
    format-string injection from user-controlled content.

    Args:
        content_tags: List of domain tags (e.g., ["travel", "food"]).
        modifiers: List of modifier tags (e.g., ["narrative", "finance"]).
        quality_rules: Combined quality rules string.
        title: Video title.
        duration_minutes: Video duration in minutes.
        user_goal: What the viewer wants from this video.
        tab_goals: Tab goals description from triage.

    Returns:
        Prompt template with {transcript} placeholder still intact.
    """
    base_path = PROMPTS_DIR / "base_extraction.txt"
    if not base_path.exists():
        raise FileNotFoundError(f"Base extraction template not found: {base_path}")

    template = _load_text(str(base_path))

    # Build combined domain schemas
    schema_parts: list[str] = []

    for tag in content_tags:
        schema = _load_schema(tag)
        if schema:
            schema_parts.append(f"--- {tag.upper()} DOMAIN ---\n{schema}")

    for modifier in modifiers:
        schema = _load_schema(modifier)
        if schema:
            schema_parts.append(f"--- {modifier.upper()} MODIFIER ---\n{schema}")

    domain_schemas = "\n\n".join(schema_parts) if schema_parts else "Use general-purpose extraction."

    # Determine primary tag for example injection
    primary_tag = content_tags[0] if content_tags else "learning"
    domain_example = _load_domain_example(primary_tag)

    # Inject everything EXCEPT {transcript} — caller decides whether to fill it
    return (
        template
        .replace("{domain_schemas}", domain_schemas)
        .replace("{quality_rules}", quality_rules)
        .replace("{title}", sanitize_for_prompt(title))
        .replace("{duration_minutes}", str(duration_minutes))
        .replace("{user_goal}", user_goal or "Extract the most useful information from this video")
        .replace("{tab_goals}", tab_goals or "Not specified — use your best judgment for tab coverage")
        .replace("{detail_level}", detail_level)
        .replace("{content_emphasis}", content_emphasis or "Extract with precision and completeness.")
        .replace("{video_context}", video_context or "Not available")
        .replace("{primary_tag}", primary_tag)
        .replace("{domain_example}", domain_example)
        .replace("{language_instruction}", language_instruction)
    )


def build_extraction_prompt(
    content_tags: list[str],
    modifiers: list[str],
    transcript: str,
    quality_rules: str,
    title: str = "",
    duration_minutes: int = 0,
    user_goal: str = "",
    tab_goals: str = "",
    detail_level: str = "standard",
    content_emphasis: str = "",
    video_context: str = "",
    language_instruction: str = "",
) -> str:
    """Assemble a complete extraction prompt from base template + domain schemas.

    Args:
        content_tags: List of domain tags (e.g., ["travel", "food"]).
        modifiers: List of modifier tags (e.g., ["narrative", "finance"]).
        transcript: Full transcript text.
        quality_rules: Combined quality rules string.
        title: Video title.
        duration_minutes: Video duration in minutes.
        user_goal: What the viewer wants from this video.
        tab_goals: Tab goals description from triage.
        detail_level: "concise", "standard", or "detailed" based on duration.
        content_emphasis: Domain-specific priority instructions.

    Returns:
        Assembled prompt string ready for LLM.
    """
    template = _build_base_template(
        content_tags, modifiers, quality_rules, title, duration_minutes,
        user_goal, tab_goals, detail_level, content_emphasis, video_context,
        language_instruction,
    )
    return template.replace("{transcript}", transcript)


def build_extraction_template(
    content_tags: list[str],
    modifiers: list[str],
    quality_rules: str,
    title: str = "",
    duration_minutes: int = 0,
    user_goal: str = "",
    tab_goals: str = "",
    detail_level: str = "standard",
    content_emphasis: str = "",
    video_context: str = "",
    language_instruction: str = "",
) -> str:
    """Build extraction prompt template with {transcript} placeholder for extractor to fill.

    Similar to build_extraction_prompt() but does NOT replace {transcript}.
    The extractor injects transcript per-segment for adaptive splitting.

    Args:
        content_tags: List of domain tags (e.g., ["travel", "food"]).
        modifiers: List of modifier tags (e.g., ["narrative", "finance"]).
        quality_rules: Combined quality rules string.
        title: Video title.
        duration_minutes: Video duration in minutes.
        user_goal: What the viewer wants from this video.
        tab_goals: Tab goals description from triage.
        detail_level: "concise", "standard", or "detailed" based on duration.
        content_emphasis: Domain-specific priority instructions.

    Returns:
        Prompt template string with {transcript} placeholder intact.
    """
    return _build_base_template(
        content_tags, modifiers, quality_rules, title, duration_minutes,
        user_goal, tab_goals, detail_level, content_emphasis, video_context,
        language_instruction,
    )
