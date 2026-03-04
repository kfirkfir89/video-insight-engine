"""Shared JSON parsing utilities for LLM responses."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _strip_json_comments(text: str) -> str:
    """Remove // line comments from JSON text while preserving strings.

    LLMs sometimes include JavaScript-style comments in their JSON output
    (learned from prompt templates). This strips them so json.loads() works.
    Handles // inside quoted strings (e.g. URLs) by tracking string state.
    """
    result: list[str] = []
    i = 0
    length = len(text)

    while i < length:
        ch = text[i]

        # Track quoted strings — skip their contents entirely
        if ch == '"':
            j = i + 1
            while j < length:
                if text[j] == '\\':
                    j += 2  # skip escaped char
                    continue
                if text[j] == '"':
                    j += 1
                    break
                j += 1
            result.append(text[i:j])
            i = j
            continue

        # Outside a string: check for // comment
        if ch == '/' and i + 1 < length and text[i + 1] == '/':
            # Skip to end of line
            newline = text.find('\n', i)
            if newline < 0:
                break  # rest of text is a comment
            i = newline  # keep the newline itself (next iteration appends it)
            continue

        result.append(ch)
        i += 1

    return "".join(result)


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
    Strips ``//`` line comments before parsing.
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
            cleaned = _strip_json_comments(text[start:end])
            result = json.loads(cleaned)
            if isinstance(result, list):
                return result
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON array response: %s, text preview: %.200s", e, text)
    return fallback if fallback is not None else []


def parse_json_response(text: str, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    """Parse JSON from LLM response text.

    Finds the first balanced JSON object in the text using bracket counting.
    Only extracts JSON objects (``{}``), not arrays (``[]``).
    Strips ``//`` line comments before parsing.
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
            cleaned = _strip_json_comments(text[start:end])
            return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON response: %s, text preview: %.200s", e, text)
    return fallback if fallback is not None else {}
