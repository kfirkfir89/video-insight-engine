"""Triage stage result type.

The LLM-driven ``run_triage`` stage was superseded by the plan stage
(``plan.py`` — a single strategic call that owns domains, modifiers, and tab
layout). ``TriageResult`` remains the pipeline's carrier for that decision:
``phases/triage.py`` populates it from the plan output and downstream stages
(extraction, enrichment) consume it unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TriageResult:
    """Result of the triage pipeline stage."""

    content_tags: list[str] = field(default_factory=lambda: ["learning"])
    modifiers: list[str] = field(default_factory=list)
    primary_tag: str = "learning"
    user_goal: str = "General summary of the video content"
    tabs: list[dict] = field(default_factory=list)
    confidence: float = 0.0
