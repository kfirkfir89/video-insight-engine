"""Extract summary and bullets from ContentBlocks for LLM prompts.

This module provides on-demand extraction of summary text and bullet points
from dynamic content blocks. These functions replace pre-computed summary/bullets
fields, ensuring a single source of truth (content blocks only).

Used by:
- LLM service (master summary, synthesis)
- Explainer service (chat context building)

Supports ALL 31 block types defined in @vie/types.
"""


def extract_summary_from_content(content: list) -> str:
    """Extract summary text from dynamic content blocks.

    Extracts text from ALL block types that contain prose/text content.
    Returns concatenated text suitable for LLM context.

    Args:
        content: List of content block dictionaries

    Returns:
        Extracted summary string, or empty string if no content
    """
    if not content:
        return ""

    texts: list[str] = []

    for block in content:
        if not isinstance(block, dict):
            continue

        block_type = block.get("type")

        # Universal blocks with text
        if block_type == "paragraph":
            text = block.get("text", "")
            if text:
                texts.append(text)

        elif block_type == "quote":
            text = block.get("text", "")
            attribution = block.get("attribution", "")
            if text:
                if attribution:
                    texts.append(f'"{text}" — {attribution}')
                else:
                    texts.append(f'"{text}"')

        elif block_type == "definition":
            term = block.get("term", "")
            meaning = block.get("meaning", "")
            if term and meaning:
                texts.append(f"{term}: {meaning}")

        elif block_type == "callout":
            text = block.get("text", "")
            if text:
                texts.append(text)

        elif block_type == "example":
            explanation = block.get("explanation", "")
            title = block.get("title", "")
            if explanation:
                texts.append(explanation)
            elif title:
                texts.append(title)

        elif block_type == "timestamp":
            label = block.get("label", "")
            if label:
                texts.append(label)

        elif block_type == "statistic":
            items = block.get("items", [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        value = item.get("value", "")
                        label = item.get("label", "")
                        if value and label:
                            texts.append(f"{label}: {value}")

        # Comparison block - extract key points
        elif block_type == "comparison":
            left = block.get("left", {})
            right = block.get("right", {})
            left_label = left.get("label", "Option A") if isinstance(left, dict) else "Option A"
            right_label = right.get("label", "Option B") if isinstance(right, dict) else "Option B"
            texts.append(f"Comparison: {left_label} vs {right_label}")

        # Verdict block
        elif block_type == "verdict":
            summary = block.get("summary", "")
            if summary:
                texts.append(summary)

        # List-based blocks - take first item as summary hint
        elif block_type in ("bullets", "numbered"):
            items = block.get("items", [])
            if items and isinstance(items, list) and len(items) > 0:
                texts.append(str(items[0]))

    return " ".join(texts) if texts else ""


def extract_bullets_from_content(content: list) -> list[str]:
    """Extract bullet points from dynamic content blocks.

    Extracts list items from ALL block types that contain enumerable content.
    Returns list of strings suitable for display or LLM context.

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

        # Universal list blocks
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
                        bullets.append(f"✓ {item}")
            if isinstance(dont_items, list):
                for item in dont_items:
                    if item:
                        bullets.append(f"✗ {item}")

        elif block_type == "callout":
            style = block.get("style", "note")
            text = block.get("text", "")
            if text:
                style_label = str(style).replace("_", " ").title()
                bullets.append(f"{style_label}: {text}")

        # Quote as bullet
        elif block_type == "quote":
            text = block.get("text", "")
            attribution = block.get("attribution", "")
            if text:
                if attribution:
                    bullets.append(f'"{text}" — {attribution}')
                else:
                    bullets.append(f'"{text}"')

        # Comparison block - extract items from both sides
        elif block_type == "comparison":
            left = block.get("left", {})
            right = block.get("right", {})
            if isinstance(left, dict):
                left_label = left.get("label", "Left")
                left_items = left.get("items", [])
                if isinstance(left_items, list):
                    for item in left_items:
                        if item:
                            bullets.append(f"{left_label}: {item}")
            if isinstance(right, dict):
                right_label = right.get("label", "Right")
                right_items = right.get("items", [])
                if isinstance(right_items, list):
                    for item in right_items:
                        if item:
                            bullets.append(f"{right_label}: {item}")

        # Pro/Con block
        elif block_type == "pro_con":
            pros = block.get("pros", [])
            cons = block.get("cons", [])
            if isinstance(pros, list):
                for item in pros:
                    if item:
                        bullets.append(f"✓ Pro: {item}")
            if isinstance(cons, list):
                for item in cons:
                    if item:
                        bullets.append(f"✗ Con: {item}")

        # Timestamp as bullet
        elif block_type == "timestamp":
            time = block.get("time", "")
            label = block.get("label", "")
            if time and label:
                bullets.append(f"[{time}] {label}")

        # Statistic items
        elif block_type == "statistic":
            items = block.get("items", [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        value = item.get("value", "")
                        label = item.get("label", "")
                        if value and label:
                            bullets.append(f"{label}: {value}")

        # Definition as bullet
        elif block_type == "definition":
            term = block.get("term", "")
            meaning = block.get("meaning", "")
            if term and meaning:
                bullets.append(f"{term}: {meaning}")

        # Key-value items
        elif block_type == "keyvalue":
            items = block.get("items", [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        key = item.get("key", "")
                        value = item.get("value", "")
                        if key and value:
                            bullets.append(f"{key}: {value}")

        # Cooking: ingredients
        elif block_type == "ingredient":
            items = block.get("items", [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        name = item.get("name", "")
                        amount = item.get("amount", "")
                        unit = item.get("unit", "")
                        if name:
                            if amount and unit:
                                bullets.append(f"{amount} {unit} {name}")
                            elif amount:
                                bullets.append(f"{amount} {name}")
                            else:
                                bullets.append(name)

        # Cooking: steps
        elif block_type == "step":
            steps = block.get("steps", [])
            if isinstance(steps, list):
                for step in steps:
                    if isinstance(step, dict):
                        num = step.get("number", "")
                        instruction = step.get("instruction", "")
                        if instruction:
                            bullets.append(f"{num}. {instruction}" if num else instruction)

        # Fitness: exercises
        elif block_type == "exercise":
            exercises = block.get("exercises", [])
            if isinstance(exercises, list):
                for ex in exercises:
                    if isinstance(ex, dict):
                        name = ex.get("name", "")
                        reps = ex.get("reps", "")
                        sets = ex.get("sets", "")
                        if name:
                            if sets and reps:
                                bullets.append(f"{name}: {sets} sets × {reps}")
                            elif reps:
                                bullets.append(f"{name}: {reps}")
                            else:
                                bullets.append(name)

        # Travel: locations
        elif block_type == "location":
            name = block.get("name", "")
            description = block.get("description", "")
            if name:
                if description:
                    bullets.append(f"{name}: {description}")
                else:
                    bullets.append(name)

        # Travel: costs
        elif block_type == "cost":
            items = block.get("items", [])
            currency = block.get("currency", "$")
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        category = item.get("category", "")
                        amount = item.get("amount", 0)
                        if category:
                            bullets.append(f"{category}: {currency}{amount}")

        # Tool list
        elif block_type == "tool_list":
            tools = block.get("tools", [])
            if isinstance(tools, list):
                for tool in tools:
                    if isinstance(tool, dict):
                        name = tool.get("name", "")
                        quantity = tool.get("quantity", "")
                        if name:
                            if quantity:
                                bullets.append(f"{name} ({quantity})")
                            else:
                                bullets.append(name)

    return bullets
