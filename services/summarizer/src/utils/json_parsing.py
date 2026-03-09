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


def _repair_truncated_json(text: str) -> str | None:
    """Attempt to repair truncated JSON by closing unclosed brackets/braces.

    When an LLM response is cut short (finish_reason=length), the JSON is
    syntactically incomplete. This function:
    1. Strips markdown fences if present
    2. Finds the first ``{`` or ``[``
    3. Walks the text tracking open brackets, braces, and strings
    4. If truncated mid-string, backtracks to before the unclosed string
    5. Removes the last incomplete key-value pair or element
    6. Appends missing closing characters

    Returns the repaired JSON string, or None if no JSON start is found.
    """
    import re

    # Strip markdown fences
    stripped = text.strip()
    if stripped.startswith("```"):
        first_nl = stripped.find("\n")
        if first_nl >= 0:
            stripped = stripped[first_nl + 1:]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]

    # Find first JSON start
    obj_start = stripped.find("{")
    arr_start = stripped.find("[")
    if obj_start < 0 and arr_start < 0:
        return None
    if obj_start < 0:
        start = arr_start
    elif arr_start < 0:
        start = obj_start
    else:
        start = min(obj_start, arr_start)

    body = stripped[start:]

    # Walk the text tracking nesting
    stack: list[str] = []
    in_string = False
    escape = False
    string_start = -1

    for i, ch in enumerate(body):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            if not in_string:
                in_string = True
                string_start = i
            else:
                in_string = False
            continue
        if in_string:
            continue
        if ch in "{[":
            stack.append(ch)
            continue
        if ch == "}":
            if stack and stack[-1] == "{":
                stack.pop()
                if not stack:
                    return body[: i + 1]
            continue
        if ch == "]":
            if stack and stack[-1] == "[":
                stack.pop()
                if not stack:
                    return body[: i + 1]
            continue

    if not stack:
        return body

    # If truncated mid-string, cut back to before the unclosed quote
    if in_string and string_start >= 0:
        body = body[:string_start]

    # Iteratively clean trailing incomplete content and try to parse
    closers = {"[": "]", "{": "}"}

    def _close(s: str) -> str:
        """Append missing closing chars based on current stack."""
        result = s
        for opener in reversed(stack):
            result += closers[opener]
        return result

    def _try_closed(s: str) -> str | None:
        """Try to parse s with closing brackets; return closed string or None."""
        candidate = _close(s)
        try:
            json.loads(candidate)
            return candidate
        except (json.JSONDecodeError, ValueError):
            return None

    # Clean trailing whitespace, commas, colons
    body = body.rstrip()
    while body and body[-1] in ",:":
        body = body[:-1].rstrip()

    # Try as-is first
    result = _try_closed(body)
    if result:
        return result

    # Strip trailing dangling key: `"key"` at end (with or without leading comma)
    cleaned = re.sub(r',?\s*"[^"]*"\s*$', '', body)
    if cleaned != body:
        result = _try_closed(cleaned)
        if result:
            return result

    # Strip trailing incomplete object/array opener: `{...` or `[...` without close
    # e.g. `[{"a":1}, {"b"` → `[{"a":1}`
    cleaned = re.sub(r',?\s*[{\[]\s*("([^"]*)"[^}\]]*)?$', '', body)
    if cleaned != body:
        result = _try_closed(cleaned)
        if result:
            return result

    # Last resort: find the last comma and truncate there
    last_comma = body.rfind(",")
    if last_comma > 0:
        trimmed = body[:last_comma].rstrip()
        result = _try_closed(trimmed)
        if result:
            return result

    return _close(body)


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
    # Strip markdown code fences
    stripped = text.strip()
    if stripped.startswith("```"):
        first_nl = stripped.find("\n")
        if first_nl >= 0:
            stripped = stripped[first_nl + 1:]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    else:
        stripped = text

    try:
        start, end = _find_json_array_boundaries(stripped)
        if start >= 0 and end > start:
            raw_json = stripped[start:end]
            # Try without comment stripping first
            result = json.loads(raw_json)
            if isinstance(result, list):
                return result
    except json.JSONDecodeError:
        pass

    try:
        start, end = _find_json_array_boundaries(stripped)
        if start >= 0 and end > start:
            cleaned = _strip_json_comments(stripped[start:end])
            result = json.loads(cleaned)
            if isinstance(result, list):
                return result
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON array response: %s, text preview: %.200s", e, stripped)

    # Fallback: try to repair truncated JSON array
    repaired = _repair_truncated_json(text)
    if repaired:
        try:
            result = json.loads(repaired)
            if isinstance(result, list):
                logger.warning("Repaired truncated JSON array response (original len=%d)", len(text))
                return result
        except (json.JSONDecodeError, ValueError):
            pass

    return fallback if fallback is not None else []


def _repair_json(text: str) -> str:
    """Attempt to repair common LLM JSON errors.

    Handles:
    - Trailing commas before } or ]
    - Control characters in strings
    - Single quotes used instead of double quotes (outside strings)
    """
    import re
    # Remove trailing commas before } or ]
    text = re.sub(r',\s*([}\]])', r'\1', text)
    # Remove control characters except \n, \r, \t
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    return text


def _try_parse_json(text: str) -> dict[str, Any] | None:
    """Try multiple strategies to parse JSON."""
    # Strategy 1: Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Repair and retry
    repaired = _repair_json(text)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Strategy 3: strict=False (allows control chars in strings)
    try:
        decoder = json.JSONDecoder(strict=False)
        result, _ = decoder.raw_decode(repaired)
        if isinstance(result, dict):
            return result
    except (json.JSONDecodeError, ValueError):
        pass

    return None


def parse_json_response(text: str, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    """Parse JSON from LLM response text.

    Finds the first balanced JSON object in the text using bracket counting.
    Only extracts JSON objects (``{}``), not arrays (``[]``).
    Strips ``//`` line comments before parsing.
    Attempts repair on first failure (trailing commas, control chars).
    Returns the fallback dict (or empty dict) on failure.

    Args:
        text: Raw LLM response text that may contain JSON.
        fallback: Optional fallback dict to return on parse failure.

    Returns:
        Parsed JSON dict, or fallback/empty dict on failure.
    """
    # Strip markdown code fences before parsing
    stripped = text.strip()
    if stripped.startswith("```"):
        first_nl = stripped.find("\n")
        if first_nl >= 0:
            stripped = stripped[first_nl + 1:]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    else:
        stripped = text

    start, end = _find_json_boundaries(stripped)
    if start >= 0 and end > start:
        raw_json = stripped[start:end]
        # Try without comment stripping first (safer — comment stripper can corrupt
        # JSON with unescaped quotes in string values)
        result = _try_parse_json(raw_json)
        if result is not None:
            return result
        # Fallback: try with comment stripping
        cleaned = _strip_json_comments(raw_json)
        result = _try_parse_json(cleaned)
        if result is not None:
            return result
        logger.warning("Failed to parse JSON response, preview: %.300s", raw_json[:300])

    # Fallback: try to repair truncated JSON
    repaired = _repair_truncated_json(text)
    if repaired:
        try:
            result = _try_parse_json(repaired)
            if result is not None and isinstance(result, dict):
                logger.warning("Repaired truncated JSON response (original len=%d)", len(text))
                return result
        except (json.JSONDecodeError, ValueError):
            pass

    return fallback if fallback is not None else {}
