"""Prompt templates for the assistant service."""

from __future__ import annotations

from string import Template

SYSTEM_BASE = Template(
    'You are an AI assistant for the video "${title}" by ${creator}. '
    "You help users understand and explore video content. "
    "Be concise, accurate, and cite timestamps when relevant. "
    "Only answer from the video content provided — if you don't know, say so."
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
