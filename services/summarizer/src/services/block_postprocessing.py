"""Post-generation block processing for chapter summaries.

Extracted from llm.py to keep the LLM service focused on prompt construction
and API calls. Contains:
- Block diversity enforcement (callout/comparison trimming, cross-chapter checks)
- View resolution (block inference, LLM validation, persona fallback)
- Block metrics logging
"""

import logging

from src.config import settings
from src.services.youtube import CATEGORY_TO_PERSONA
from src.utils.constants import GENERIC_ATTRIBUTIONS

logger = logging.getLogger(__name__)

# ── Per-Chapter View Constants ──

# Valid view values matching VideoCategory type
VALID_VIEWS: frozenset[str] = frozenset([
    'cooking', 'coding', 'reviews', 'travel', 'fitness',
    'education', 'podcast', 'diy', 'gaming', 'standard',
])

# Signature blocks used for soft correction of LLM view
VIEW_SIGNATURE_BLOCKS: dict[str, set[str]] = {
    'cooking': {'ingredient', 'step', 'nutrition'},
    'coding': {'code', 'terminal', 'file_tree'},
    'reviews': {'pro_con', 'rating', 'verdict'},
    'travel': {'location', 'itinerary'},
    'fitness': {'exercise', 'workout_timer'},
    'education': {'quiz', 'formula'},
    'podcast': {'guest'},              # Single signature — relies on LLM (transcript removed)
    'diy': {'tool_list', 'step'},       # 'step' overlaps with cooking — handled by 2+ threshold
    'gaming': set(),                     # No unique signature blocks — relies on LLM
    'standard': set(),
}

# Per-view signature thresholds (default=2, podcast=1 since it only has `guest`)
VIEW_SIGNATURE_THRESHOLD: dict[str, int] = {'podcast': 1}
DEFAULT_THRESHOLD = 2

# Post-generation diversity enforcement limits
CALLOUT_MAX_PER_CHAPTER = 1
COMPARISON_MAX_PER_CHAPTER = 1

# Persona → category (view) mapping for category-aware fallback.
# Derived from youtube.py's CATEGORY_TO_PERSONA (single source of truth)
# by inverting the mapping. Many-to-one entries (gaming→standard, diy→standard)
# are dropped since standard is the default fallback anyway.
PERSONA_CATEGORY_MAP: dict[str, str] = {
    persona: category
    for category, persona in CATEGORY_TO_PERSONA.items()
    if persona != 'standard'  # skip many-to-one (gaming, diy → standard)
}
PERSONA_CATEGORY_MAP['standard'] = 'standard'

# Category to preferred V2.1 block types mapping
# Used for logging metrics and future prompt injection
CATEGORY_BLOCKS: dict[str, list[str]] = {
    'code': ['code', 'terminal', 'file_tree', 'definition', 'quiz'],
    'recipe': ['ingredient', 'step', 'nutrition', 'tool_list'],
    'review': ['pro_con', 'rating', 'verdict', 'cost'],
    'fitness': ['exercise', 'workout_timer'],
    'travel': ['location', 'itinerary', 'cost'],
    'education': ['quiz', 'formula', 'timeline', 'definition'],
    'interview': ['guest', 'quote', 'timestamp'],
    'standard': [],
}


# ─────────────────────────────────────────────────────────────────────────────
# View Resolution
# ─────────────────────────────────────────────────────────────────────────────


def infer_view_from_blocks(content: list[dict]) -> str | None:
    """Infer view from content blocks using signature block matching.

    Only overrides LLM view when 2+ distinct signature blocks match
    a single view. Returns None to defer to LLM when no strong match.

    Args:
        content: List of content block dictionaries

    Returns:
        View name if strong match found, None otherwise.
    """
    if not content:
        return None

    block_types = {b.get("type") for b in content if isinstance(b, dict) and b.get("type")}

    # Count matching signature blocks per view (per-view thresholds)
    matches: dict[str, int] = {}
    for view, sig_blocks in VIEW_SIGNATURE_BLOCKS.items():
        if not sig_blocks:
            continue
        count = len(block_types & sig_blocks)
        threshold = VIEW_SIGNATURE_THRESHOLD.get(view, DEFAULT_THRESHOLD)
        if count >= threshold:
            matches[view] = count

    if not matches:
        return None

    # If exactly one view has 2+ matches, return it
    if len(matches) == 1:
        return next(iter(matches))

    # Tie between views — defer to LLM
    return None


def resolve_view(
    content: list[dict],
    llm_view_raw: str,
    title: str,
    persona_hint: str | None = None,
) -> str:
    """Resolve final per-chapter view from LLM output + block inference + persona fallback.

    Priority: block inference > LLM view > category fallback > 'standard'.

    Args:
        content: List of content block dictionaries
        llm_view_raw: Raw view string from LLM response
        title: Chapter title for logging context
        persona_hint: Persona name for category-aware fallback (e.g., 'interview' → 'podcast')

    Returns:
        Resolved view string (always a valid view value).
    """
    llm_view = llm_view_raw if llm_view_raw in VALID_VIEWS else "standard"
    inferred = infer_view_from_blocks(content)
    if inferred and inferred != llm_view:
        logger.warning(
            "View mismatch for '%s': LLM=%s, inferred=%s. Using inferred.",
            title, llm_view, inferred,
        )
        return inferred

    # Persona-aware fallback: when LLM returns 'standard' but persona implies a view
    if llm_view == "standard" and persona_hint:
        category_view = PERSONA_CATEGORY_MAP.get(persona_hint)
        if category_view and category_view != "standard":
            logger.info(
                "Persona fallback for '%s': LLM=%s, persona_hint=%s → %s",
                title, llm_view, persona_hint, category_view,
            )
            return category_view

    return llm_view


# ─────────────────────────────────────────────────────────────────────────────
# Block Diversity Enforcement
# ─────────────────────────────────────────────────────────────────────────────


def trim_excess_block_type(
    content: list[dict],
    block_type: str,
    max_count: int,
    title: str,
) -> list[dict]:
    """Keep at most `max_count` blocks of `block_type`, dropping extras from the end."""
    count = sum(1 for b in content if b.get("type") == block_type)
    if count <= max_count:
        return content
    kept = 0
    result = []
    for b in content:
        if b.get("type") == block_type:
            kept += 1
            if kept <= max_count:
                result.append(b)
            else:
                logger.debug("Trimmed excess %s in '%s'", block_type, title)
        else:
            result.append(b)
    return result


def _enforce_frame_limits(content: list[dict], title: str) -> list[dict]:
    """Trim excess frames in visual blocks to configured limits.

    Enforces MAX_FRAMES_PER_VISUAL per block and MAX_FRAMES_PER_CHAPTER total.
    Removes visual blocks that have no description AND no imageUrl after trimming.
    """
    total_frames = 0
    result = []
    for b in content:
        if b.get("type") != "visual":
            result.append(b)
            continue

        frames = b.get("frames")
        if frames and isinstance(frames, list) and len(frames) > 1:
            # Trim to per-block limit
            max_allowed = min(
                settings.MAX_FRAMES_PER_VISUAL,
                settings.MAX_FRAMES_PER_CHAPTER - total_frames,
            )
            if max_allowed < 2:
                # Not enough budget for a gallery — convert to single-frame
                b = {k: v for k, v in b.items() if k != "frames"}
                total_frames += 1
            else:
                trimmed = frames[:max_allowed]
                if len(trimmed) < len(frames):
                    logger.debug(
                        "Trimmed frames %d→%d in visual block in '%s'",
                        len(frames), len(trimmed), title,
                    )
                b = {**b, "frames": trimmed}
                total_frames += len(trimmed)
        else:
            total_frames += 1

        # Keep block if it has description or image data
        if b.get("description") or b.get("imageUrl") or b.get("frames"):
            result.append(b)
        else:
            logger.debug("Removed empty visual block in '%s'", title)

    return result


def enforce_block_diversity(
    content: list[dict],
    title: str,
    prev_block_types: list[str] | None = None,
) -> list[dict]:
    """Post-generation safety net: enforce block diversity rules.

    Rules:
    1. Max 1 callout per chapter (keep first, drop extras from end)
    2. Max 1 comparison per chapter (keep first)
    3. No consecutive same-ending blocks across chapters
    4. Replace generic quote attributions with highlight variant

    Args:
        content: List of content block dicts from LLM output.
        title: Chapter title for logging context.
        prev_block_types: Block types from the previous chapter (for cross-chapter checks).

    Returns:
        Filtered content list with diversity rules enforced.
    """
    if not content:
        return content

    # 1. Trim excess callouts (keep first, drop rest)
    content = trim_excess_block_type(content, "callout", CALLOUT_MAX_PER_CHAPTER, title)

    # 2. Trim excess comparisons (keep first)
    content = trim_excess_block_type(content, "comparison", COMPARISON_MAX_PER_CHAPTER, title)

    # 3. If last block is callout and prev chapter also ended with callout, remove it
    if (
        prev_block_types
        and len(content) > 1
        and content[-1].get("type") == "callout"
        and prev_block_types[-1] == "callout"
    ):
        content = content[:-1]
        logger.debug(
            "Removed trailing callout to avoid cross-chapter repetition in '%s'", title,
        )

    # 4. Enforce visual block frame limits
    content = _enforce_frame_limits(content, title)

    # 5. Replace generic quote attributions with highlight variant.
    # Modified blocks are shallow-copied; unmodified blocks pass through by
    # reference (the caller shares references to the original dicts).
    result = []
    for b in content:
        if b.get("type") == "quote" and b.get("attribution"):
            attr = b["attribution"].strip().lower()
            if attr in GENERIC_ATTRIBUTIONS:
                b = {k: v for k, v in b.items() if k != "attribution"}
                b["variant"] = "highlight"
                logger.debug(
                    "Replaced generic attribution '%s' with highlight in '%s'", attr, title,
                )
        result.append(b)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Block Metrics
# ─────────────────────────────────────────────────────────────────────────────


def log_block_metrics(
    content: list[dict],
    chapter_title: str,
    persona: str,
    view: str = 'standard',
) -> None:
    """Log block generation metrics for analysis.

    Tracks:
    - Block type diversity
    - Paragraph ratio (lower is better for information density)
    - Category-appropriate block usage

    Args:
        content: List of content blocks
        chapter_title: Title for logging context
        persona: Content persona used
        view: Per-chapter view value
    """
    if not content:
        return

    block_types = [b.get("type") for b in content if isinstance(b, dict) and b.get("type")]
    unique_types = set(block_types)
    total_blocks = len(block_types)

    # Count paragraphs
    paragraph_count = sum(1 for t in block_types if t == "paragraph")
    paragraph_ratio = paragraph_count / total_blocks if total_blocks > 0 else 0

    # Check category-appropriate block usage
    category_blocks = CATEGORY_BLOCKS.get(persona, [])
    category_block_count = sum(1 for t in block_types if t in category_blocks)
    category_match_ratio = category_block_count / total_blocks if total_blocks > 0 else 0

    # Log metrics
    logger.info(
        "chapter_summary_blocks",
        extra={
            "chapter_title": chapter_title[:50],
            "persona": persona,
            "view": view,
            "total_blocks": total_blocks,
            "unique_block_types": len(unique_types),
            "block_types": list(block_types),
            "paragraph_ratio": round(paragraph_ratio, 2),
            "category_match_ratio": round(category_match_ratio, 2),
        },
    )
