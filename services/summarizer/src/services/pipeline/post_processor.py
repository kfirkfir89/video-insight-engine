"""Post-processing utilities for pipeline output."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ...models.pipeline_types import ManifestResult

logger = logging.getLogger(__name__)

# Tab IDs that typically contain checklists or quizzes — eligible for celebrations
_CELEBRATION_TAB_IDS = frozenset({
    "quizzes", "flashcards", "scenarios", "packing", "ingredients", "materials", "tools",
})


def drop_empty_tabs(tabs: list[dict], data: dict) -> list[dict]:
    """Remove tabs whose dataSource has fewer than 2 items in the data.

    A tab's dataSource is a dot-separated path like "travel.itinerary".
    If the resolved value is a list with fewer than 2 items, the tab is dropped.
    Non-list values and missing paths are kept (they may be scalars or not yet populated).

    Args:
        tabs: List of tab definitions with "dataSource" keys.
        data: Extracted data dict to check against.

    Returns:
        Filtered list of tabs with non-empty data sources.
    """
    result: list[dict] = []
    for tab in tabs:
        data_source = tab.get("dataSource", "")
        if not data_source:
            result.append(tab)
            continue

        # Resolve dot-separated path
        parts = data_source.split(".")
        value = data
        resolved = True
        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                resolved = False
                break

        # Keep tab if path didn't resolve (might be populated later)
        # or if value is not a list (scalar/object data)
        # or if list has 2+ items
        if not resolved or not isinstance(value, list) or len(value) >= 2:
            result.append(tab)
        else:
            logger.debug("Dropping tab %s — dataSource %s has %d items", tab.get("id"), data_source, len(value))

    return result


def assign_section_accents(sections: list[dict]) -> list[dict]:
    """Assign accentIndex 0-6 cycling to sections for visual variety.

    Each section gets an accentIndex that cycles through 0-6,
    which the frontend uses for accent colors.

    Args:
        sections: List of section definitions.

    Returns:
        Sections with accentIndex added (new list, originals not mutated).
    """
    result: list[dict] = []
    for idx, section in enumerate(sections):
        new_section = dict(section)
        new_section["accentIndex"] = idx % 7
        result.append(new_section)
    return result


def merge_narrative(data: dict, narrative_data: dict | None) -> dict:
    """Merge narrative modifier enrichment into main data.

    Adds narrative key moments, quotes, and takeaways to the data dict
    under the "narrative" key. If narrative_data is None, returns data unchanged.

    Args:
        data: Main extracted data dict.
        narrative_data: Narrative modifier data or None.

    Returns:
        Data dict with narrative data merged in.
    """
    if not narrative_data:
        return data

    result = dict(data)
    result["narrative"] = narrative_data
    return result


def resolve_celebrations(tabs: list[dict]) -> list[dict]:
    """Determine which tabs should trigger celebrations.

    Tabs with IDs matching checklist/quiz patterns get a "celebration" flag
    set to True. The frontend uses this to show confetti or completion animations.

    Args:
        tabs: List of tab definitions.

    Returns:
        Tabs with "celebration" boolean added (new list, originals not mutated).
    """
    result: list[dict] = []
    for tab in tabs:
        new_tab = dict(tab)
        tab_id = tab.get("id", "")
        new_tab["celebration"] = tab_id in _CELEBRATION_TAB_IDS
        result.append(new_tab)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Extraction Count Validation (advisory, non-blocking)
# ─────────────────────────────────────────────────────────────────────────────

# Mapping: manifest itemCounts field → where to find extracted items in the data
_COUNT_EXTRACTORS: dict[str, list[str]] = {
    "spots": ["travel.itinerary.*.spots"],
    "ingredients": ["food.ingredients"],
    "exercises": ["fitness.exercises"],
    "steps": ["food.steps", "project.steps"],
    "songs": ["music.structure"],
    "tips": ["food.tips", "fitness.tips", "travel.itinerary.*.tips"],
    "products": ["review.comparisons"],
}

COMPLETENESS_THRESHOLD = 0.6


def _count_items_at_path(data: dict, path: str) -> int:
    """Count items at a dot-separated path. Supports wildcard for nested lists.

    Examples:
        "food.ingredients" → len(data["food"]["ingredients"])
        "travel.itinerary.*.spots" → sum(len(day["spots"]) for day in data["travel"]["itinerary"])
    """
    parts = path.split(".")
    current: list = [data]

    for part in parts:
        next_level: list = []
        for node in current:
            if part == "*":
                if isinstance(node, list):
                    next_level.extend(node)
            elif isinstance(node, dict) and part in node:
                next_level.append(node[part])
        current = next_level

    total = 0
    for node in current:
        if isinstance(node, list):
            total += len(node)
    return total


def validate_extraction_counts(
    manifest: ManifestResult | None,
    extraction_data: dict | None,
) -> dict[str, dict]:
    """Compare manifest item counts against extraction results.

    Returns a dict of warnings for items where extraction < 60% of manifest.
    Logs warnings but does NOT block the pipeline.

    Args:
        manifest: ManifestResult from the manifest stage (or None).
        extraction_data: Validated extraction data dict (or None).

    Returns:
        Dict of {field: {"manifest": N, "extracted": M, "ratio": float}} for warnings.
    """
    if manifest is None or extraction_data is None:
        return {}

    warnings: dict[str, dict] = {}
    counts = manifest.item_counts

    for field, paths in _COUNT_EXTRACTORS.items():
        manifest_count = getattr(counts, field, 0)
        if manifest_count == 0:
            continue

        extracted_count = sum(_count_items_at_path(extraction_data, p) for p in paths)
        ratio = extracted_count / manifest_count if manifest_count > 0 else 1.0

        if ratio < COMPLETENESS_THRESHOLD:
            warnings[field] = {
                "manifest": manifest_count,
                "extracted": extracted_count,
                "ratio": round(ratio, 2),
            }
            logger.warning(
                "Extraction completeness warning: %s — manifest=%d, extracted=%d (%.0f%%)",
                field, manifest_count, extracted_count, ratio * 100,
            )

    return warnings
