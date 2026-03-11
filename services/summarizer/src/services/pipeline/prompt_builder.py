"""Schema injection system — assembles extraction prompts from base template + domain schemas."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"
SCHEMAS_DIR = PROMPTS_DIR / "schemas"


@lru_cache(maxsize=16)
def _load_text(path_str: str) -> str:
    """Load and cache a text file from disk."""
    return Path(path_str).read_text()


def _load_schema(name: str) -> str:
    """Load a domain or modifier schema file.

    Args:
        name: Schema name (e.g., "travel", "food", "narrative").

    Returns:
        Schema text content, or empty string if file not found.
    """
    schema_path = SCHEMAS_DIR / f"{name}.txt"
    if not schema_path.exists():
        logger.warning("Schema file not found: %s", schema_path)
        return ""
    return _load_text(str(schema_path))


def build_extraction_prompt(
    content_tags: list[str],
    modifiers: list[str],
    transcript: str,
    accuracy_rules: str,
    title: str = "",
    duration_minutes: int = 0,
) -> str:
    """Assemble a complete extraction prompt from base template + domain schemas.

    Loads the base_extraction.txt template, then injects domain schemas for
    each content tag and modifier. Uses .replace() (not .format()) to avoid
    format-string injection from user-controlled content.

    Args:
        content_tags: List of domain tags (e.g., ["travel", "food"]).
        modifiers: List of modifier tags (e.g., ["narrative", "finance"]).
        transcript: Full transcript text.
        accuracy_rules: Combined accuracy rules string.
        title: Video title.
        duration_minutes: Video duration in minutes.

    Returns:
        Assembled prompt string ready for LLM.
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

    # Inject using .replace() — safe against user-controlled content
    prompt = (
        template
        .replace("{domain_schemas}", domain_schemas)
        .replace("{transcript}", transcript)
        .replace("{accuracy_rules}", accuracy_rules)
        .replace("{title}", title)
        .replace("{duration_minutes}", str(duration_minutes))
    )

    return prompt


def build_extraction_template(
    content_tags: list[str],
    modifiers: list[str],
    accuracy_rules: str,
    title: str = "",
    duration_minutes: int = 0,
) -> str:
    """Build extraction prompt template with {transcript} placeholder for extractor to fill.

    Similar to build_extraction_prompt() but does NOT replace {transcript}.
    The extractor injects transcript per-segment for adaptive splitting.

    Args:
        content_tags: List of domain tags (e.g., ["travel", "food"]).
        modifiers: List of modifier tags (e.g., ["narrative", "finance"]).
        accuracy_rules: Combined accuracy rules string.
        title: Video title.
        duration_minutes: Video duration in minutes.

    Returns:
        Prompt template string with {transcript} placeholder intact.
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

    # Inject everything EXCEPT {transcript} — extractor handles that for adaptive splitting
    prompt = (
        template
        .replace("{domain_schemas}", domain_schemas)
        .replace("{accuracy_rules}", accuracy_rules)
        .replace("{title}", title)
        .replace("{duration_minutes}", str(duration_minutes))
    )

    return prompt
