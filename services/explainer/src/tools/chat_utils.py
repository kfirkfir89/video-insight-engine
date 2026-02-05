"""Shared utilities for chat tools."""

from src.schemas import MemorizedItem
from src.services.llm import load_prompt
from src.utils.content_extractor import (
    extract_summary_from_content,
    extract_bullets_from_content,
)


def format_content(source: dict) -> str:
    """Format memorized item source content for LLM prompt.

    Args:
        source: Source content dict with sections, concept, or expansion

    Returns:
        Formatted markdown string
    """
    content_parts = []
    content = source.get("content", {})

    if "sections" in content:
        for section in content["sections"]:
            content_parts.append(
                f"## {section.get('title', 'Section')} ({section.get('timestamp', '')})"
            )
            # Extract summary and bullets from content blocks on-demand
            section_content = section.get("content", [])
            summary = extract_summary_from_content(section_content)
            bullets = extract_bullets_from_content(section_content)

            if summary:
                content_parts.append(summary)
            if bullets:
                content_parts.append("Key points:")
                for bullet in bullets:
                    content_parts.append(f"- {bullet}")
            content_parts.append("")

    if "concept" in content:
        concept = content["concept"]
        content_parts.append(f"## Concept: {concept.get('name', '')}")
        content_parts.append(concept.get("definition", ""))

    if "expansion" in content:
        content_parts.append("## Explained Content")
        content_parts.append(content["expansion"])

    return "\n".join(content_parts)


def build_system_prompt(item: MemorizedItem) -> str:
    """Build system prompt from memorized item.

    Args:
        item: MemorizedItem domain object

    Returns:
        Formatted system prompt string
    """
    return load_prompt("chat_system").format(
        title=item.title,
        video_title=item.source.videoTitle,
        youtube_url=item.source.youtubeUrl,
        content=format_content({"content": item.source.content}),
        notes=item.notes or "None",
    )
