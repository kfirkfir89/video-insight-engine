"""Plan pipeline stage — merged manifest + triage in a single LLM call.

Replaces the old 2-call flow (manifest → triage) with a single Sonnet call
that produces both video analysis and tab layout design.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from ...models.pipeline_types import PlanResult
from ...shared_config.domain_config import build_fallback_tabs, map_category_to_tag, valid_components
from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from .assembly import infer_component
from .pipeline_helpers import sanitize_for_prompt

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "plan.txt"
COMPONENT_TOOLKIT_PATH = Path(__file__).parent.parent.parent / "prompts" / "component_toolkit.txt"

CONFIDENCE_THRESHOLD = 0.6


@lru_cache(maxsize=1)
def _load_plan_prompt() -> str:
    """Load and cache the plan prompt template."""
    return PROMPT_PATH.read_text()


@lru_cache(maxsize=1)
def _load_component_toolkit() -> str:
    """Load and cache the component toolkit reference."""
    if COMPONENT_TOOLKIT_PATH.exists():
        return COMPONENT_TOOLKIT_PATH.read_text()
    logger.warning("Component toolkit not found at %s", COMPONENT_TOOLKIT_PATH)
    return ""


def _build_fallback_plan(category_hint: str | None = None) -> PlanResult:
    """Build a fallback PlanResult when LLM fails or confidence is low."""
    primary = map_category_to_tag(category_hint) if category_hint else "learning"
    tags = [primary]

    return PlanResult.model_validate({
        "contentTags": tags,
        "modifiers": [],
        "primaryTag": primary,
        "userGoal": "General summary of the video content",
        "tabs": build_fallback_tabs(primary),
        "confidence": 0.0,
    })


def _validate_tabs(tabs: list[dict]) -> list[dict]:
    """Validate and normalize tabs from LLM response."""

    if not isinstance(tabs, list):
        return []

    valid_component_names = valid_components()
    valid_tabs = []
    seen_ids: set[str] = set()

    for tab in tabs[:6]:
        if not isinstance(tab, dict) or "id" not in tab or "label" not in tab:
            continue

        tid = tab["id"]
        if not re.match(r'^[a-z][a-z0-9_]*$', tid):
            logger.info("Invalid tab ID format '%s', skipping", tid)
            continue
        if tid in seen_ids:
            logger.info("Duplicate tab ID '%s', skipping", tid)
            continue
        seen_ids.add(tid)

        component = tab.get("component", "")
        if component and component not in valid_component_names:
            logger.info("Invalid component '%s' for tab '%s', inferring from tab ID", component, tid)
            component = ""
        if not component:
            component = infer_component(tid)

        valid_tabs.append({
            "id": tid,
            "label": tab["label"],
            "emoji": tab.get("emoji", ""),
            "dataSource": tab.get("dataSource", ""),
            "component": component,
            "goal": tab.get("goal", ""),
        })

    return valid_tabs


async def run_plan(
    title: str,
    channel: str,
    description: str,
    duration: int,
    category_hint: str | None,
    content_format: str | None,
    transcript_preview: str,
    llm_service: LLMService,
    content_traits: str | None = None,
) -> PlanResult:
    """Run the plan stage — single Sonnet call for video analysis + tab design.

    Merges the old manifest + triage stages into one call. Uses plan.txt prompt.

    Args:
        title: Video title.
        channel: Channel name.
        description: Video description (truncated).
        duration: Video duration in seconds.
        category_hint: Category from classifier or metadata.
        content_format: Content format from classifier (tutorial, commentary, etc.).
        transcript_preview: First ~3K chars of cleaned transcript.
        llm_service: LLM service instance.

    Returns:
        PlanResult on success, fallback PlanResult on failure.
    """
    try:
        prompt_template = _load_plan_prompt()
    except FileNotFoundError:
        logger.error("Plan prompt not found at %s", PROMPT_PATH)
        return _build_fallback_plan(category_hint)

    component_toolkit = _load_component_toolkit()
    duration_minutes = str(round(duration / 60)) if duration > 0 else "unknown"

    # Split prompt into static (cacheable) and dynamic parts.
    # Static: role + instructions + component_toolkit + output_schema + examples + rules
    # Dynamic: video details + transcript_preview
    static_template = prompt_template.replace("{component_toolkit}", component_toolkit)

    # Find the split point at <video> tag — everything before it is static
    video_marker = "<video>"
    split_idx = static_template.find(video_marker)

    if split_idx > 0:
        cache_static = static_template[:split_idx]
        dynamic_part = static_template[split_idx:]
    else:
        cache_static = None
        dynamic_part = static_template

    prompt = (
        dynamic_part
        .replace("{title}", sanitize_for_prompt(title[:200]))
        .replace("{channel}", sanitize_for_prompt(channel[:100] if channel else "Unknown"))
        .replace("{duration_minutes}", duration_minutes)
        .replace("{category_hint}", category_hint or "unknown")
        .replace("{content_format}", content_format or "unknown")
        .replace("{description}", sanitize_for_prompt(description[:1000] if description else "N/A", max_len=1000))
        .replace("{transcript_preview}", sanitize_for_prompt(transcript_preview[:3000], max_len=3000))
        .replace("{content_traits}", content_traits or "Not available")
    )

    try:
        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=2048, timeout=30.0, max_retries=2, stage_name="plan",
            json_mode=True, cache_static=cache_static,
        )
        if not raw:
            logger.warning("Plan LLM call failed after retries, using fallback")
            return _build_fallback_plan(category_hint)

        logger.debug("Plan raw response (len=%d): %.500s", len(raw), raw)
        data = parse_json_response(raw)

        if not data:
            logger.warning("Empty JSON from plan, falling back. Raw: %.300s", raw[:300])
            return _build_fallback_plan(category_hint)

        # Validate tabs before creating PlanResult
        raw_tabs = data.get("tabs", [])
        validated_tabs = _validate_tabs(raw_tabs)
        data["tabs"] = validated_tabs

        # Normalize content tags
        content_tags = data.get("contentTags", [])
        if isinstance(content_tags, str):
            content_tags = [content_tags]
        if not content_tags:
            content_tags = ["learning"]
        data["contentTags"] = content_tags

        # Validate primary tag
        primary_tag = data.get("primaryTag", content_tags[0])
        if primary_tag not in content_tags:
            primary_tag = content_tags[0]
        data["primaryTag"] = primary_tag

        # Fallback tabs if none valid
        if not validated_tabs:
            data["tabs"] = build_fallback_tabs(primary_tag)

        result = PlanResult.model_validate(data)

        if result.confidence < CONFIDENCE_THRESHOLD:
            logger.info("Low plan confidence (%.2f), falling back", result.confidence)
            fallback = _build_fallback_plan(category_hint)
            fallback.confidence = result.confidence
            return fallback

        return result

    except Exception as e:
        logger.error("Plan failed (%s): %s — falling back", type(e).__name__, e)
        return _build_fallback_plan(category_hint)
