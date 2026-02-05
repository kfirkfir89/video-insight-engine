"""Extract summary and bullets from ContentBlocks for LLM prompts.

This module provides on-demand extraction of summary text and bullet points
from dynamic content blocks. These functions replace pre-computed summary/bullets
fields, ensuring a single source of truth (content blocks only).

Used by:
- Chat context building in explain_chat tools
"""


def extract_summary_from_content(content: list) -> str:
    """Extract summary text from dynamic content blocks.

    Priority order:
    1. Paragraphs - Join all paragraph block texts
    2. Definitions - Join as "term: meaning"
    3. Callouts - Join callout texts
    4. First bullet - First item from bullets/numbered block

    Args:
        content: List of content block dictionaries

    Returns:
        Extracted summary string, or empty string if no content
    """
    if not content:
        return ""

    paragraphs: list[str] = []
    definitions: list[str] = []
    callouts: list[str] = []
    first_bullet: str | None = None

    for block in content:
        if not isinstance(block, dict):
            continue

        block_type = block.get("type")

        if block_type == "paragraph":
            text = block.get("text", "")
            if text:
                paragraphs.append(text)

        elif block_type == "definition":
            term = block.get("term", "")
            meaning = block.get("meaning", "")
            if term and meaning:
                definitions.append(f"{term}: {meaning}")

        elif block_type == "callout":
            text = block.get("text", "")
            if text:
                callouts.append(text)

        elif block_type in ("bullets", "numbered") and first_bullet is None:
            items = block.get("items", [])
            if items and isinstance(items, list) and len(items) > 0:
                first_bullet = str(items[0])

    # Return in priority order
    if paragraphs:
        return " ".join(paragraphs)
    if definitions:
        return " ".join(definitions)
    if callouts:
        return " ".join(callouts)
    if first_bullet:
        return first_bullet

    return ""


def extract_bullets_from_content(content: list) -> list[str]:
    """Extract bullet points from dynamic content blocks.

    Sources (in order of appearance):
    - bullets block: All items from items[]
    - numbered block: All items from items[]
    - do_dont block: "Do: {item}" / "Don't: {item}"
    - callout block: "{Style}: {text}"

    Args:
        content: List of content block dictionaries

    Returns:
        List of extracted bullet strings
    """
    if not content:
        return []

    bullets: list[str] = []

    for block in content:
        if not isinstance(block, dict):
            continue

        block_type = block.get("type")

        if block_type == "bullets":
            items = block.get("items", [])
            if isinstance(items, list):
                bullets.extend(str(item) for item in items if item)

        elif block_type == "numbered":
            items = block.get("items", [])
            if isinstance(items, list):
                bullets.extend(str(item) for item in items if item)

        elif block_type == "do_dont":
            do_items = block.get("do", [])
            dont_items = block.get("dont", [])
            if isinstance(do_items, list):
                for item in do_items:
                    if item:
                        bullets.append(f"Do: {item}")
            if isinstance(dont_items, list):
                for item in dont_items:
                    if item:
                        bullets.append(f"Don't: {item}")

        elif block_type == "callout":
            style = block.get("style", "note")
            text = block.get("text", "")
            if text:
                # Capitalize style for readability
                style_label = str(style).replace("_", " ").title()
                bullets.append(f"{style_label}: {text}")

    return bullets
