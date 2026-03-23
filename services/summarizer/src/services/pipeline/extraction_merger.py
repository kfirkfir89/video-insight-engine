"""Merge per-batch extraction results into a single extraction dict.

Handles list concatenation, dedup, re-numbering of ordered items,
and scalar field selection. Output is compatible with assembly stage.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Fields that indicate an item should be deduped by this key (case-insensitive)
_IDENTITY_KEYS = frozenset({"name", "label", "term", "title", "ingredient", "tool", "location"})

# Fields that indicate ordered items (should be re-numbered after merge)
_ORDER_KEYS = frozenset({"number", "step", "order", "index"})


def merge_batch_extractions(
    batch_results: list[dict[str, Any] | None],
    content_tags: list[str],
) -> dict[str, Any]:
    """Merge per-batch extractions into a single extraction result.

    Rules:
    - List fields: concatenate across batches, then dedup
    - Ordered lists (steps, timeline): concatenate in batch order, re-number
    - Text fields: keep longest version
    - Numeric fields: keep from first non-empty batch
    - Nested dicts: recursive merge

    Args:
        batch_results: List of extraction dicts (one per batch), may contain None.
        content_tags: Content tags from triage (e.g., ["learning", "tech"]).

    Returns:
        Merged extraction dict compatible with assembly/validation.
    """
    valid_results = [r for r in batch_results if r]
    if not valid_results:
        return {}

    if len(valid_results) == 1:
        return valid_results[0]

    merged: dict[str, Any] = {}
    for result in valid_results:
        merged = _merge_dicts(merged, result)

    # Final dedup pass on all list fields
    merged = _deduplicate_all_lists(merged)

    # Re-number ordered lists
    _renumber_ordered_lists(merged)

    return merged


def _merge_dicts(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Recursively merge incoming dict into base dict."""
    result = dict(base)
    for key, value in incoming.items():
        if key not in result:
            result[key] = value
        elif isinstance(value, list) and isinstance(result[key], list):
            result[key] = result[key] + value
        elif isinstance(value, dict) and isinstance(result[key], dict):
            result[key] = _merge_dicts(result[key], value)
        elif isinstance(value, str) and isinstance(result[key], str):
            # Keep longest string
            if len(value) > len(result[key]):
                result[key] = value
        elif value is not None and result[key] is None:
            result[key] = value
        # For other types (numbers, booleans), keep first non-empty
    return result


def _deduplicate_all_lists(data: dict[str, Any]) -> dict[str, Any]:
    """Deduplicate all list fields in the dict, recursively."""
    result = dict(data)
    for key, value in result.items():
        if isinstance(value, list) and len(value) > 1:
            result[key] = _dedup_list(value)
        elif isinstance(value, dict):
            result[key] = _deduplicate_all_lists(value)
    return result


def _dedup_list(items: list[Any]) -> list[Any]:
    """Deduplicate a list of items.

    - Dicts with identity keys: dedup by that key (case-insensitive)
    - Dicts without identity keys: JSON-serialization dedup
    - Strings: exact dedup (preserving order)
    """
    if not items:
        return items

    first = items[0]

    if isinstance(first, dict):
        # Find identity key
        identity_key = _find_identity_key(first)
        if identity_key:
            return _dedup_by_key(items, identity_key)
        # Fallback: JSON serialization dedup
        return _dedup_by_json(items)

    if isinstance(first, str):
        seen: set[str] = set()
        deduped: list[Any] = []
        for item in items:
            normalized = item.strip().lower()
            if normalized not in seen:
                seen.add(normalized)
                deduped.append(item)
        return deduped

    # For other types, JSON dedup
    return _dedup_by_json(items)


def _find_identity_key(item: dict) -> str | None:
    """Find the identity key for dedup in a dict item."""
    for key in _IDENTITY_KEYS:
        if key in item:
            return key
    return None


def _dedup_by_key(items: list[dict], key: str) -> list[dict]:
    """Deduplicate dicts by a specific key (case-insensitive)."""
    seen: set[str] = set()
    deduped: list[dict] = []
    for item in items:
        value = item.get(key, "")
        normalized = str(value).strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(item)
        elif not normalized:
            deduped.append(item)
    return deduped


def _dedup_by_json(items: list[Any]) -> list[Any]:
    """Deduplicate by JSON serialization."""
    seen: set[str] = set()
    deduped: list[Any] = []
    for item in items:
        try:
            item_key = json.dumps(item, sort_keys=True)
        except (TypeError, ValueError):
            item_key = str(item)
        if item_key not in seen:
            seen.add(item_key)
            deduped.append(item)
    return deduped


def _renumber_ordered_lists(data: dict[str, Any]) -> None:
    """Re-number ordered lists in-place after merge.

    Looks for list items with order/step/number fields and re-numbers them
    sequentially starting from 1.
    """
    for value in data.values():
        if isinstance(value, list) and value:
            first = value[0]
            if isinstance(first, dict):
                order_key = _find_order_key(first)
                if order_key:
                    for i, item in enumerate(value):
                        if isinstance(item, dict):
                            item[order_key] = i + 1
        elif isinstance(value, dict):
            _renumber_ordered_lists(value)


def _find_order_key(item: dict) -> str | None:
    """Find the order/numbering key in a dict item."""
    for key in _ORDER_KEYS:
        if key in item:
            return key
    return None
