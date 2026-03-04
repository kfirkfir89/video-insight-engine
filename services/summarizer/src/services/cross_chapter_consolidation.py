"""Cross-chapter consolidation for output-type-specific content.

After all chapters are processed, consolidation merges scattered blocks
into coherent output sections. For example, a recipe video with ingredients
spread across 3 chapters gets a single consolidated ingredients list.

Only certain output types trigger consolidation — others keep chapter structure.
"""

import logging
import uuid
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

# Output types that benefit from cross-chapter consolidation
CONSOLIDATION_TYPES: frozenset[str] = frozenset([
    "recipe", "tutorial", "workout", "travel_plan",
])


def consolidate_chapters(
    chapters: list[dict[str, Any]],
    output_type: str,
) -> dict[str, Any] | None:
    """Consolidate scattered blocks across chapters for applicable output types.

    Args:
        chapters: List of processed chapter dicts (with "content" blocks).
        output_type: The detected output type.

    Returns:
        Consolidated data dict if applicable, None otherwise.
        The dict contains merged blocks with injected blockIds.
    """
    if output_type not in CONSOLIDATION_TYPES:
        return None

    if len(chapters) < 2:
        return None

    strategy = _STRATEGIES.get(output_type)
    if not strategy:
        return None

    try:
        result = strategy(chapters)
        if result:
            # Inject blockIds into consolidated blocks
            for block in result.get("blocks", []):
                if isinstance(block, dict) and "blockId" not in block:
                    block["blockId"] = str(uuid.uuid4())
            logger.info(
                "Consolidated %d chapters for output_type=%s: %d blocks",
                len(chapters), output_type, len(result.get("blocks", [])),
            )
        return result
    except (KeyError, TypeError, IndexError) as e:
        logger.error("Consolidation failed for %s: %s", output_type, e, exc_info=True)
        return None


def _ingredient_dedup_key(item: Any) -> str:
    """Extract a dedup key from an ingredient item (str or dict)."""
    if isinstance(item, dict):
        name = item.get("name", "")
        amount = item.get("amount", "")
        unit = item.get("unit", "")
        return f"{name} {amount} {unit}".strip().lower()
    return str(item).strip().lower()


def _step_dedup_key(item: Any) -> str:
    """Extract a dedup key from a step item (str or dict)."""
    if isinstance(item, dict):
        return item.get("instruction", "").strip().lower()
    return str(item).strip().lower()


def _consolidate_recipe(chapters: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Merge ingredient and step blocks from all chapters into single lists.

    Handles both plain string items (legacy/bullets/numbered variants)
    and structured dict items (v2.1 ingredient/step blocks).
    """
    all_ingredients: list[str | dict[str, Any]] = []
    all_steps: list[str | dict[str, Any]] = []
    step_provenance: list[dict[str, Any]] = []
    seen_ingredients: set[str] = set()
    seen_steps: set[str] = set()

    for chapter in chapters:
        chapter_title = chapter.get("title", "")
        for block in chapter.get("content", []):
            block_type = block.get("type", "")
            is_ingredient = (
                block_type == "ingredient"
                or (block_type == "bullets" and block.get("variant") == "ingredients")
            )
            is_step = (
                block_type == "step"
                or (block_type == "numbered" and block.get("variant") == "cooking_steps")
            )

            if is_ingredient:
                for item in block.get("items", []):
                    normalized = _ingredient_dedup_key(item)
                    if normalized and normalized not in seen_ingredients:
                        seen_ingredients.add(normalized)
                        all_ingredients.append(item)

            elif is_step:
                # v2.1 step blocks use "steps" array; legacy uses "items"
                step_items = block.get("steps", []) or block.get("items", [])
                for item in step_items:
                    normalized = _step_dedup_key(item)
                    if normalized and normalized not in seen_steps:
                        seen_steps.add(normalized)
                        all_steps.append(item)
                        if isinstance(item, dict):
                            step_provenance.append({**item, "chapterTitle": chapter_title})
                        else:
                            text = str(item).strip()
                            step_provenance.append({"text": text, "chapterTitle": chapter_title})

    if not all_ingredients and not all_steps:
        return None

    blocks: list[dict[str, Any]] = []
    if all_ingredients:
        blocks.append({
            "type": "ingredient",
            "items": all_ingredients,
            "label": "All Ingredients",
        })
    if all_steps:
        blocks.append({
            "type": "step",
            "items": all_steps,
            "steps": step_provenance,
            "label": "Complete Steps",
        })

    return {"outputType": "recipe", "label": "Complete Recipe", "blocks": blocks}


def _consolidate_tutorial(chapters: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Merge code and terminal blocks into an ordered sequence."""
    code_blocks: list[dict[str, Any]] = []

    for chapter in chapters:
        chapter_title = chapter.get("title", "")
        for block in chapter.get("content", []):
            block_type = block.get("type", "")
            if block_type in ("code", "terminal", "file_tree"):
                merged = {**block, "chapterTitle": chapter_title}
                code_blocks.append(merged)

    if not code_blocks:
        return None

    return {
        "outputType": "tutorial",
        "label": "Complete Code Reference",
        "blocks": code_blocks,
    }


def _consolidate_workout(chapters: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Merge exercise blocks into a single workout plan."""
    exercises: list[dict[str, Any]] = []

    for chapter in chapters:
        chapter_title = chapter.get("title", "")
        for block in chapter.get("content", []):
            if block.get("type") == "exercise":
                exercises.append({**block, "chapterTitle": chapter_title})
            elif block.get("type") == "workout_timer":
                exercises.append({**block, "chapterTitle": chapter_title})

    if not exercises:
        return None

    return {
        "outputType": "workout",
        "label": "Complete Workout",
        "blocks": exercises,
    }


def _consolidate_travel(chapters: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Merge itinerary and cost blocks into a single travel plan."""
    itinerary_blocks: list[dict[str, Any]] = []
    cost_blocks: list[dict[str, Any]] = []

    for chapter in chapters:
        chapter_title = chapter.get("title", "")
        for block in chapter.get("content", []):
            block_type = block.get("type", "")
            if block_type in ("itinerary", "location"):
                itinerary_blocks.append({**block, "chapterTitle": chapter_title})
            elif block_type == "cost":
                cost_blocks.append({**block, "chapterTitle": chapter_title})

    if not itinerary_blocks and not cost_blocks:
        return None

    blocks: list[dict[str, Any]] = []
    blocks.extend(itinerary_blocks)
    if cost_blocks:
        blocks.extend(cost_blocks)

    return {
        "outputType": "travel_plan",
        "label": "Complete Travel Plan",
        "blocks": blocks,
    }


_ConsolidationFn = Callable[[list[dict[str, Any]]], dict[str, Any] | None]

# Strategy dispatch
_STRATEGIES: dict[str, _ConsolidationFn] = {
    "recipe": _consolidate_recipe,
    "tutorial": _consolidate_tutorial,
    "workout": _consolidate_workout,
    "travel_plan": _consolidate_travel,
}
