"""Adaptive frame-pipeline effort tier — how visual-critical is this video?

HIGH tier (unboxings, travel, food, …): the visuals ARE the content, so the
extractor over-selects candidates and vision-describes them all, letting
subject-matter frames win over presenter shots. LOW tier (podcasts, news):
frames are decoration — skip vision entirely. Everything else is STANDARD.

Derived from metadata (category + title keywords + tags) because domain/format
classification runs AFTER the frames phase — see visualCriticalityNote in
packages/shared/src/config/domains.json, which single-sources the tier table.
"""

from __future__ import annotations

import logging
from typing import Literal

from src.shared_config.domain_config import map_category_to_tag, visual_criticality_config

logger = logging.getLogger(__name__)

VisualTier = Literal["high", "standard", "low"]


def derive_tier(
    category: str | None,
    title: str,
    tags: list[str] | None = None,
) -> VisualTier:
    """Pick the frame-effort tier for a video from cheap metadata signals.

    Title/tag keyword hits win over domain lists (an "unboxing" title in any
    domain is visual-critical); the category-derived domain decides otherwise.
    Unknown/missing config degrades to "standard".
    """
    cfg = visual_criticality_config()
    if not cfg:
        return "standard"

    haystack = " ".join([title.lower(), *[t.lower() for t in (tags or [])]])
    if any(keyword in haystack for keyword in cfg.get("highTitleKeywords", [])):
        return "high"

    domain = map_category_to_tag(category) if category else None
    if domain in set(cfg.get("highDomains", [])):
        return "high"
    if domain in set(cfg.get("lowDomains", [])):
        return "low"
    return "standard"


def tier_settings(tier: VisualTier) -> dict:
    """The tier's knob values from config (overselect / visionMax / keep)."""
    cfg = visual_criticality_config()
    return dict((cfg.get("tiers") or {}).get(tier, {}))
