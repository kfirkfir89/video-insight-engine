"""Shared JSON parsing utilities for LLM responses."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _find_balanced_boundaries(text: str, open_ch: str, close_ch: str) -> tuple[int, int]:
    """Find the start and end of the first balanced JSON structure in text.

    Uses bracket counting to handle nested structures correctly, avoiding the
    problem where ``rfind(close_ch)`` captures trailing non-JSON text.

    Args:
        text: Raw text to search.
        open_ch: Opening bracket character ('{' or '[').
        close_ch: Closing bracket character ('}' or ']').

    Returns:
        (start, end) indices where text[start:end] is the balanced structure,
        or (-1, -1) if no balanced structure is found.
    """
    start = text.find(open_ch)
    if start < 0:
        return -1, -1
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return start, i + 1
    return -1, -1


def _find_json_boundaries(text: str) -> tuple[int, int]:
    """Find the first balanced JSON object ``{...}`` in text."""
    return _find_balanced_boundaries(text, '{', '}')


def _find_json_array_boundaries(text: str) -> tuple[int, int]:
    """Find the first balanced JSON array ``[...]`` in text."""
    return _find_balanced_boundaries(text, '[', ']')


def parse_json_array_response(text: str, fallback: list[Any] | None = None) -> list[Any]:
    """Parse a JSON array from LLM response text.

    Finds the first balanced JSON array in the text using bracket counting.
    Only extracts JSON arrays (``[]``), not objects (``{}``).
    Returns the fallback list (or empty list) on failure.

    Args:
        text: Raw LLM response text that may contain a JSON array.
        fallback: Optional fallback list to return on parse failure.

    Returns:
        Parsed JSON list, or fallback/empty list on failure.
    """
    try:
        start, end = _find_json_array_boundaries(text)
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            if isinstance(result, list):
                return result
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON array response: %s, text preview: %.200s", e, text)
    return fallback if fallback is not None else []


def parse_json_response(text: str, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    """Parse JSON from LLM response text.

    Finds the first balanced JSON object in the text using bracket counting.
    Only extracts JSON objects (``{}``), not arrays (``[]``).
    Returns the fallback dict (or empty dict) on failure.

    Args:
        text: Raw LLM response text that may contain JSON.
        fallback: Optional fallback dict to return on parse failure.

    Returns:
        Parsed JSON dict, or fallback/empty dict on failure.
    """
    try:
        start, end = _find_json_boundaries(text)
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON response: %s, text preview: %.200s", e, text)
    return fallback if fallback is not None else {}
