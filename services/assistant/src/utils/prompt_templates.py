"""Prompt templates for the assistant service."""

from __future__ import annotations

from string import Template

SYSTEM_BASE = Template(
    'You are a friendly, helpful assistant for the video "${title}" by ${creator}. '
    "Chat naturally and conversationally, the way ChatGPT or Claude would. "
    "Use the video content below to ground your answers; if something isn't "
    'covered, just say so briefly. Never mention "excerpts", "context", or '
    '"transcript sections" — just answer the question directly.'
)

CONTEXT_TEMPLATE = Template(
    "## Overview\n"
    "${summary}\n\n"
    "${takeaways_section}"
    "${tabs_section}"
    "${rag_section}"
)

TAKEAWAYS_HEADER = "## Key Takeaways\n"

TABS_HEADER = "## Content Tabs\n"

RAG_HEADER = "## Relevant Transcript Sections\n"

LIBRARY_SYSTEM_BASE = (
    "You are a friendly, helpful assistant for the user's personal video library. "
    "Chat naturally and conversationally, the way ChatGPT or Claude would. "
    "Below you may be given the list of videos in the library and some relevant "
    "content pulled from them. Use that material to ground your answers, but "
    'NEVER mention "excerpts", "chunks", "context", "sources", or internal video '
    "ids in your reply. When you refer to a specific video, use its title in plain "
    "language. If the material doesn't cover the question, answer helpfully from "
    "what you know or say you're not sure — keep it natural and never apologize "
    "about missing excerpts."
)

LIBRARY_INVENTORY_HEADER = "## Videos in the user's library\n"

LIBRARY_SOURCES_HEADER = (
    "## Relevant content from the library "
    "(background for grounding — do not mention or quote this heading)\n"
)
