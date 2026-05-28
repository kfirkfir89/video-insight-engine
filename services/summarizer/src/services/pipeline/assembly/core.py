"""Assembly orchestrator — assembles final VIEResponse from pipeline outputs.

Resolves data sources, runs assemblers, validates domain requirements,
injects frame thumbnails, and produces the final {meta, tabs[]} shape.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from src.utils.data_helpers import is_empty_data

from .assemblers import (
    ASSEMBLER_REGISTRY,
    _chapters_to_moments,
    assemble_display_section,
    infer_component,
)
from .cross_tab import resolve_cross_tab_links

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────
# Data Source Resolution
# ─────────────────────────────────────────────────────


def resolve_data_source(
    data_source: str,
    extraction: dict | None,
    enrichment: dict | None = None,
) -> Any:
    """Resolve a dot-notation dataSource to actual data.

    Examples:
        "travel.itinerary"   -> extraction["travel"]["itinerary"]
        "enrichment.quiz"    -> enrichment["quiz"]
        "fitness"            -> extraction["fitness"]
    """
    if not data_source:
        return None

    parts = data_source.split(".")

    if parts[0] == "enrichment":
        if not enrichment:
            return None
        obj: Any = enrichment
        for part in parts[1:]:
            if part == "*":
                return obj
            if isinstance(obj, dict) and part in obj:
                obj = obj[part]
            else:
                return None
        return obj

    obj = extraction
    for part in parts:
        if part == "*":
            return obj
        if isinstance(obj, dict) and part in obj:
            obj = obj[part]
        else:
            return None
    return obj


# ─────────────────────────────────────────────────────
# Frame Utilities
# ─────────────────────────────────────────────────────


def find_nearest_frame(
    timestamp_seconds: float,
    frames: list[dict],
    max_distance: float = 30.0,
) -> dict | None:
    """Find the frame closest to a given timestamp."""
    if not frames:
        return None
    nearest = min(frames, key=lambda f: abs(f.get("timestamp", 0) - timestamp_seconds))
    if abs(nearest.get("timestamp", 0) - timestamp_seconds) <= max_distance:
        return nearest
    return None


# Scene types that should never feed a frame thumbnail — these are filler
# (presenter face, video opener) and adding them as "evidence" pretends the
# frame supports the claim when it doesn't. Talking_head frames pass through
# only when the vision LLM marks them as educationally valuable.
_NON_EVIDENCE_SCENE_TYPES: frozenset[str] = frozenset({
    "talking_head", "intro", "outro", "transition", "black", "logo",
})


def _attach_frame_metadata(
    item: dict,
    source_frame: dict,
    frame_descriptions: list[dict] | None,
) -> None:
    """Enrich an item with frame thumb + (when available) vision metadata.

    Vision descriptions carry the actual semantic payload — scene_type,
    educational_value, and a one-line `content` caption — but they're cheap
    to look up and the audit showed they're computed and thrown away. Here we
    fuse them onto the item so MomentTrack/StepPlayer/CodeExplorer/Comparison
    can render evidence captions alongside the thumbnail.
    """
    item["thumbnailUrl"] = source_frame.get("s3_url", "")
    if source_frame.get("s3_key"):
        item["s3Key"] = source_frame["s3_key"]
    if source_frame.get("ocr_text") and not item.get("frameOcr"):
        item["frameOcr"] = source_frame["ocr_text"]

    if not frame_descriptions:
        return
    desc = find_description_for_frame(source_frame, frame_descriptions)
    if not desc:
        return

    scene_type = str(desc.get("scene_type") or "").strip().lower()
    educational = str(desc.get("educational_value") or "").strip()
    # Skip filler scenes unless the vision LLM explicitly flagged them as
    # carrying educational signal — protects against pasting random presenter
    # crops next to substantive content rows.
    if scene_type in _NON_EVIDENCE_SCENE_TYPES and not educational:
        return

    caption = str(desc.get("content") or "").strip()
    if caption:
        item["frameCaption"] = caption
    if scene_type:
        item["frameSceneType"] = scene_type
    if educational:
        item["frameEvidence"] = educational
    text_visible = str(desc.get("text_visible") or "").strip()
    if text_visible and not item.get("frameOcr"):
        item["frameOcr"] = text_visible


def inject_frame_thumbnails(
    items: list[dict],
    frames: list[dict],
    all_frames: list[dict] | None = None,
    frame_descriptions: list[dict] | None = None,
) -> list[dict]:
    """Add thumbnailUrl + optional vision metadata to items with timestamps.

    s3Key is the durable S3 object key; the API regenerates a fresh presigned
    URL from it on every read. thumbnailUrl is the at-generation-time URL —
    used by the SSE stream for immediate display. When frame_descriptions is
    provided, also attaches frameCaption / frameSceneType / frameEvidence /
    frameOcr so downstream components can render evidence inline.
    """
    if not frames:
        return items

    s3_frames = [f for f in frames if f.get("s3_url")]
    match_pool = all_frames if all_frames else s3_frames

    for item in items:
        ts = item.get("timestamp") or item.get("startTime") or item.get("seconds") or item.get("time")
        if ts is None:
            continue
        try:
            ts_float = float(ts) if not isinstance(ts, str) else None
        except (ValueError, TypeError):
            ts_float = None
        if ts_float is None:
            continue
        nearest = find_nearest_frame(ts_float, match_pool)
        source: dict | None = None
        if nearest and nearest.get("s3_url"):
            source = nearest
        elif nearest and s3_frames:
            source = find_nearest_frame(ts_float, s3_frames)
        if source:
            _attach_frame_metadata(item, source, frame_descriptions)
    return items


def find_description_for_frame(
    frame: dict,
    frame_descriptions: list[dict],
    tolerance: float = 5.0,
) -> dict | None:
    """Find a vision description matching a frame by timestamp."""
    if not frame_descriptions:
        return None
    ts = frame.get("timestamp", 0)
    best = None
    best_distance = float("inf")
    for desc in frame_descriptions:
        distance = abs(desc.get("timestamp_sec", 0) - ts)
        if distance < best_distance:
            best_distance = distance
            best = desc
    return best if best_distance <= tolerance else None


# ─────────────────────────────────────────────────────
# Domain Requirement Validation
# ─────────────────────────────────────────────────────

_DOMAIN_REQUIREMENTS: dict[str, dict] = {
    "food":     {"required": ["step_player", "checklist"], "max": {"flash_deck": 1}},
    "project":  {"required": ["step_player", "checklist"], "max": {"flash_deck": 1}},
    "review":   {"required": ["verdict", "comparison"],    "max": {"flash_deck": 1}},
    "fitness":  {"required": ["exercise_tracker"],         "max": {"flash_deck": 1}},
    "tech":     {"required": ["code_explorer"],            "max": {"flash_deck": 1, "quiz": 1}},
    "travel":   {"required": ["spot_explorer"],            "max": {"flash_deck": 1}},
    "music":    {"required": ["lyrics_player"],            "max": {"flash_deck": 1}},
    "learning": {"required": [],                           "max": {"flash_deck": 1, "quiz": 1}},
    "language": {"required": ["spot_explorer"],       "max": {"flash_deck": 1}},
    "science":  {"required": ["spot_explorer"],       "max": {"flash_deck": 1, "quiz": 1}},
}


def _validate_domain_requirements(tabs: list[dict], primary_tag: str) -> None:
    """Validate assembled tabs against domain requirements in-place."""
    reqs = _DOMAIN_REQUIREMENTS.get(primary_tag, {})
    tab_components = [t.get("component", "") for t in tabs]

    for req in reqs.get("required", []):
        if req not in tab_components:
            logger.warning(
                "Domain '%s' requires '%s' but it's missing from assembled tabs",
                primary_tag, req,
            )

    for comp, limit in reqs.get("max", {}).items():
        indices = [i for i, t in enumerate(tabs) if t.get("component") == comp]
        if len(indices) > limit:
            logger.warning(
                "'%s' appears %dx (max %d for domain '%s') — keeping first %d only",
                comp, len(indices), limit, primary_tag, limit,
            )
            for idx in reversed(indices[limit:]):
                tabs.pop(idx)

    for tab in tabs:
        if not tab.get("goal"):
            logger.warning("Tab '%s' has empty goal", tab.get("id", "?"))
        if not tab.get("label"):
            logger.warning("Tab '%s' has empty label", tab.get("id", "?"))
        label = tab.get("label", "")
        if "<Untitled" in label or "Untitled Chapter" in label:
            tab["label"] = "Introduction"


# ─────────────────────────────────────────────────────
# Post-Processing
# ─────────────────────────────────────────────────────

_UNTITLED_RE = re.compile(r'<?\s*Untitled\s+Chapter\s+(\d+)\s*>?', re.IGNORECASE)
_NO_COUNT_COMPONENTS = frozenset({"overview", "verdict", "budget"})

# Maps component → required list key. If the list is empty after assembly, drop the tab.
_COMPONENT_REQUIRED_LISTS: dict[str, str] = {
    "code_explorer": "snippets",
    "moment_track": "items",
    "exercise_tracker": "exercises",
    "quiz": "questions",
    "scenario": "scenarios",
    "spot_explorer": "spots",
    "info_grid": "items",
    "checklist": "items",
    "step_player": "steps",
    "flash_deck": "cards",
    "budget": "breakdown",
}



def _validate_assembled_props(component: str, props: dict) -> bool:
    """Validate assembled props — return False if the tab should be dropped.

    Only enforces the required list (must be non-empty). Per-component density
    minimums live inside the individual assemblers (e.g. spot_explorer's
    `_MIN_SPOTS`, comparison's real-pair check) so we can keep their thresholds
    co-located with their normalization logic.
    """
    required_key = _COMPONENT_REQUIRED_LISTS.get(component)
    if required_key is None:
        return True
    data_list = props.get(required_key)
    if not isinstance(data_list, list) or len(data_list) == 0:
        logger.warning(
            "Validation: component=%r has empty required list %r — dropping tab",
            component, required_key,
        )
        return False
    return True

_COUNT_KEYS: dict[str, str] = {
    "spot_explorer": "spots",
    "checklist": "items",
    "step_player": "steps",
    "exercise_tracker": "exercises",
    "flash_deck": "cards",
    "quiz": "questions",
    "scenario": "scenarios",
    "info_grid": "items",
    "moment_track": "items",
    "code_explorer": "snippets",
    "gallery": "images",
    "comparison": "comparisons",
    "lyrics_player": "sections",
}

# Per-component user-facing item caps. Long videos otherwise produce
# unscannable lists (29-row "comparisons", 55-item timelines). The Plan
# prompt instructs the model to respect these; we enforce in code as
# a backstop so output stays within budget regardless of prompt drift.
_TAB_ITEM_CAPS: dict[str, int] = {
    "comparison": 10,
    "moment_track": 20,
    "info_grid": 20,
    "flash_deck": 15,
    "spot_explorer": 25,
    "step_player": 25,
    "checklist": 30,
}


def _cap_tab_items(component: str, props: dict) -> None:
    """Truncate the user-facing list on a tab if it exceeds the cap."""
    cap = _TAB_ITEM_CAPS.get(component)
    if cap is None:
        return
    list_key = _COUNT_KEYS.get(component)
    if not list_key:
        return
    items = props.get(list_key)
    if isinstance(items, list) and len(items) > cap:
        logger.info(
            "Assembly: capping %s.%s from %d → %d",
            component, list_key, len(items), cap,
        )
        props[list_key] = items[:cap]


def _post_process_tabs(tabs: list[dict]) -> None:
    """Apply post-processing rules to assembled tabs in-place."""
    for i, tab in enumerate(tabs):
        label = tab.get("label", "")
        props = tab.get("props", {})
        emoji = tab.get("emoji", "")

        # Enforce per-component item caps before any count-derived labels
        # are computed, so e.g. "29 Comparisons" gets relabeled to "10".
        component = tab.get("component", "")
        if isinstance(props, dict) and component:
            _cap_tab_items(component, props)

        if emoji and label.startswith(emoji):
            label = label[len(emoji):].lstrip()
            tab["label"] = label

        match = _UNTITLED_RE.search(label)
        if match:
            label = "Introduction" if i == 0 else f"Part {match.group(1)}"
            tab["label"] = label

        if isinstance(props, dict):
            for key in ("steps", "spots", "entries", "items"):
                items_list = props.get(key)
                if isinstance(items_list, list):
                    for idx_in_list, item in enumerate(items_list):
                        if isinstance(item, dict):
                            for field in ("instruction", "label", "title", "name"):
                                val = item.get(field)
                                if isinstance(val, str):
                                    m = _UNTITLED_RE.search(val)
                                    if m:
                                        item[field] = "Introduction" if idx_in_list == 0 else f"Part {m.group(1)}"

        if component not in _NO_COUNT_COMPONENTS and isinstance(props, dict):
            if not re.match(r'^\d+\s', label):
                count_key = _COUNT_KEYS.get(component)
                if count_key and count_key in props:
                    data_list = props[count_key]
                    if isinstance(data_list, list) and len(data_list) > 0:
                        count = len(data_list)
                        tab["label"] = f"{count} {label}"


# ─────────────────────────────────────────────────────
# Empty Data Detection + Cross-Domain Fallback
# ─────────────────────────────────────────────────────

# Mapping of equivalent fields across domains for fallback resolution.
# When primary domain field is empty, try these alternatives in other domains.
_FIELD_EQUIVALENTS: dict[str, list[str]] = {
    "concepts": ["keyMoments", "keyPoints", "takeaways"],
    "keyPoints": ["takeaways", "keyMoments", "quotes", "savingTips"],
    "timestamps": ["keyMoments"],
    "takeaways": ["keyMoments", "takeaways", "keyPoints", "savingTips"],
    "keyMoments": ["keyPoints", "concepts", "takeaways"],
    "tips": ["savingTips", "transportationTips", "accommodationTips", "takeaways"],
    "packingList": ["savingTips", "tips", "takeaways"],
    "itinerary": ["keyMoments", "spots", "costs"],
    "restaurants": ["spots", "keyMoments"],
    "phrases": ["keyPoints", "vocabulary"],
    "vocabulary": ["concepts", "phrases"],
    "drills": ["steps", "exercises"],
    "keyFacts": ["keyPoints", "concepts", "takeaways"],
    "experiments": ["steps"],
    "rules": ["concepts", "keyPoints", "tips"],
}



def _cross_domain_fallback(
    data_source: str,
    extraction: dict | None,
    enrichment: dict | None = None,
) -> Any:
    """Try other extraction domains when primary domain field is empty.

    Given "learning.concepts" with empty data, scans narrative, tech, etc.
    for the same field name or equivalent fields.
    """
    if not extraction:
        return None
    parts = data_source.split(".")
    if len(parts) != 2:
        return None

    primary_domain, field = parts

    # Try exact field name in other domains first
    for domain, domain_data in extraction.items():
        if domain == primary_domain or not isinstance(domain_data, dict):
            continue
        candidate = domain_data.get(field)
        if not is_empty_data(candidate):
            logger.info(
                "Cross-domain fallback: %s.%s (empty) → %s.%s (%d items)",
                primary_domain, field, domain, field,
                len(candidate) if isinstance(candidate, (list, dict)) else 1,
            )
            return candidate

    # Try equivalent field names in other domains
    equivalents = _FIELD_EQUIVALENTS.get(field, [])
    for domain, domain_data in extraction.items():
        if domain == primary_domain or not isinstance(domain_data, dict):
            continue
        for equiv_field in equivalents:
            candidate = domain_data.get(equiv_field)
            if not is_empty_data(candidate):
                logger.info(
                    "Cross-domain fallback: %s.%s (empty) → %s.%s (%d items)",
                    primary_domain, field, domain, equiv_field,
                    len(candidate) if isinstance(candidate, (list, dict)) else 1,
                )
                return candidate

    return None


# ─────────────────────────────────────────────────────
# Overview Ordering Guarantee
# ─────────────────────────────────────────────────────


def _ensure_overview_first(
    tabs: list[dict],
    synthesis: dict | None,
    video_meta: dict | None,
    extraction: dict | None,
    enrichment: dict | None,
    primary_tag: str,
) -> None:
    """Guarantee an overview tab exists and sits at index 0.

    Finds any tab flagged as overview (id or component) and moves it to the
    front; if none exists, synthesizes one from synthesis/video_meta/extraction
    via the overview assembler and prepends it. Mutates `tabs` in place.
    """
    from .assemblers import assemble_overview

    overview_idx = next(
        (i for i, t in enumerate(tabs)
         if t.get("id") == "overview" or t.get("component") == "overview"),
        -1,
    )

    if overview_idx >= 0:
        if overview_idx != 0:
            tabs.insert(0, tabs.pop(overview_idx))
        # Normalize so the frontend always routes to OverviewInteractive.
        tabs[0]["component"] = "overview"
        return

    tab_stub = {
        "id": "overview",
        "label": "Overview",
        "emoji": "📋",
        "_primary_tag": primary_tag,
        "_synthesis": synthesis,
        "_video_meta": video_meta,
    }
    props = assemble_overview(tab_stub, None, extraction or {}, enrichment)
    if props is None:
        return
    tabs.insert(0, {
        "id": "overview",
        "label": "Overview",
        "emoji": "📋",
        "component": "overview",
        "props": props,
        "goal": "Quick summary of what this video covers",
        "crossTabLinks": [],
    })


def _annotate_overview_item_count(tabs: list[dict]) -> None:
    """Inject the content-tab count into the overview's data + stats pills.

    Must run AFTER all tab additions (cross-tab link resolution, gallery
    auto-append, fallback candidates) so `len(tabs) - 1` reflects what the
    user will actually see. Surfaces as both `data.itemCount` and an "Items"
    stat chip on the hero.
    """
    if not tabs or tabs[0].get("component") != "overview":
        return
    item_count = max(0, len(tabs) - 1)
    if item_count == 0:
        return
    props = tabs[0].get("props")
    if not isinstance(props, dict):
        return
    data = props.setdefault("data", {})
    if not isinstance(data, dict):
        return
    data["itemCount"] = item_count

    existing_stats = data.get("stats")
    stats: list[Any] = existing_stats if isinstance(existing_stats, list) else []
    if not any(isinstance(s, dict) and s.get("label") == "Items" for s in stats):
        stats.append({"label": "Items", "value": str(item_count), "emoji": "📚"})
        data["stats"] = stats


# ─────────────────────────────────────────────────────
# Fallback Tab Candidates
# ─────────────────────────────────────────────────────


def build_fallback_candidates(
    synthesis: dict | None,
    video_meta: dict | None,
    existing_components: set[str],
    existing_ids: set[str],
) -> list[dict]:
    """Build fallback tab candidates from synthesis and video metadata.

    Priority: overview > info_grid > moment_track.
    Skips candidates that duplicate existing components or IDs.
    """
    candidates: list[dict] = []
    synthesis = synthesis or {}
    video_meta = video_meta or {}

    # Fallback 1: overview from synthesis
    if "overview" not in existing_components and "overview" not in existing_ids:
        master_summary = synthesis.get("masterSummary", "")
        key_takeaways = synthesis.get("keyTakeaways", [])
        if master_summary or key_takeaways:
            candidates.append({
                "id": "overview",
                "label": "Overview",
                "emoji": "📋",
                "component": "overview",
                "props": {
                    "summary": master_summary,
                    "keyTakeaways": key_takeaways,
                    "tldr": synthesis.get("tldr", ""),
                },
                "goal": "Quick summary of what this video covers",
                "crossTabLinks": [],
            })

    # Fallback 2: info_grid from synthesis keyTakeaways
    if "info_grid" not in existing_components and "key_info" not in existing_ids:
        key_takeaways = synthesis.get("keyTakeaways", [])
        if len(key_takeaways) >= 2:
            items = [{"key": f"Takeaway {i+1}", "value": t} for i, t in enumerate(key_takeaways)]
            candidates.append({
                "id": "key_info",
                "label": "Key Info",
                "emoji": "📊",
                "component": "info_grid",
                "props": {"items": items},
                "goal": "Key takeaways from this video at a glance",
                "crossTabLinks": [],
            })

    # Fallback 3: moment_track from video chapters
    if "moment_track" not in existing_components and "key_moments" not in existing_ids:
        chapters = video_meta.get("chapters", [])
        if isinstance(chapters, list) and len(chapters) >= 2:
            chapter_dicts = [ch for ch in chapters if isinstance(ch, dict)]
            if len(chapter_dicts) >= 2:
                video_duration = video_meta.get("duration")
                try:
                    video_duration = int(video_duration) if video_duration is not None else None
                except (ValueError, TypeError):
                    video_duration = None
                items = _chapters_to_moments(chapter_dicts, video_duration)
                if len(items) >= 2:
                    candidates.append({
                        "id": "key_moments",
                        "label": "Key Moments",
                        "emoji": "🎬",
                        "component": "moment_track",
                        "props": {"items": items},
                        "goal": "Jump to the chapters of this video",
                        "crossTabLinks": [],
                    })

    return candidates


# ─────────────────────────────────────────────────────
# Main Assembly Orchestrator
# ─────────────────────────────────────────────────────


def assemble_response(
    triage: dict,
    extraction: dict | None,
    enrichment: dict | None,
    synthesis: dict | None,
    video_meta: dict | None = None,
    description_analysis: dict | None = None,
    frames: list[dict] | None = None,
    gallery_frames: list[dict] | None = None,
    all_frames: list[dict] | None = None,
    frame_descriptions: list[dict] | None = None,
) -> dict:
    """Assemble the final VIEResponse v2 from pipeline outputs.

    Returns:
        dict: { meta, tabs: TabEntry[] }.
    """
    video_meta = video_meta or {}

    meta: dict[str, Any] = {
        "contentTags": triage.get("contentTags", ["learning"]),
        "modifiers": triage.get("modifiers", []),
        "primaryTag": triage.get("primaryTag", "learning"),
        "userGoal": triage.get("userGoal", ""),
    }

    if synthesis:
        meta["tldr"] = synthesis.get("tldr", "")
        meta["seoDescription"] = synthesis.get("seoDescription", "")
        meta["masterSummary"] = synthesis.get("masterSummary", "")
        meta["keyTakeaways"] = synthesis.get("keyTakeaways", [])

    if description_analysis:
        meta["descriptionAnalysis"] = description_analysis

    primary_tag = meta["primaryTag"]
    raw_tabs = triage.get("tabs", [])
    all_tab_ids = {t.get("id", "") for t in raw_tabs if isinstance(t, dict)}

    assembled_tabs: list[dict] = []

    for raw_tab in raw_tabs:
        if not isinstance(raw_tab, dict):
            continue

        tab_id = raw_tab.get("id", "")
        data_source = raw_tab.get("dataSource", "")
        component = raw_tab.get("component") or infer_component(tab_id)

        # Guarantee id="overview" tabs always render the OverviewInteractive —
        # triage sometimes mis-tags them as display_section, which would skip
        # the interactive renderer on the frontend.
        if tab_id == "overview":
            component = "overview"

        data = resolve_data_source(data_source, extraction, enrichment)
        data_resolved = data is not None

        # Treat empty collections as missing — lets fallback logic try other domains
        if is_empty_data(data):
            data = None
            data_resolved = False

        # Cross-domain fallback: when primary domain field is empty, try other domains
        if data is None and "." in data_source:
            data = _cross_domain_fallback(data_source, extraction, enrichment)
            if data is not None:
                data_resolved = True

        if data is None and extraction:
            if tab_id in ("exercises", "timer"):
                data = extraction.get("fitness")
            elif tab_id == "pros_cons":
                review = extraction.get("review", {})
                if isinstance(review, dict):
                    data = {"pros": review.get("pros", []), "cons": review.get("cons", []), "comparisons": review.get("comparisons", [])}
            elif component == "moment_track":
                data = (extraction.get("learning") or {}).get("timestamps")

        # YouTube chapters fall through to fill *empty* moment_track data only.
        # Prior behavior (pre-MomentTrack) was the opposite: chapters always
        # overrode LLM timestamps. We flipped this with the unified MomentTrack
        # because LLM-extracted moments now carry mood / description / highlight
        # spans — strictly richer than the {start_time, title} pairs YouTube
        # exposes. When extraction returns nothing, chapters are still the best
        # navigation aid we have, so we keep the fallback.
        if component == "moment_track" and (data is None or (isinstance(data, list) and len(data) == 0)):
            yt_chapters = (video_meta or {}).get("chapters", [])
            if isinstance(yt_chapters, list) and len(yt_chapters) > 0:
                chapter_dicts = [ch for ch in yt_chapters if isinstance(ch, dict)]
                if chapter_dicts:
                    video_duration = video_meta.get("duration") if video_meta else None
                    try:
                        video_duration = int(video_duration) if video_duration is not None else None
                    except (ValueError, TypeError):
                        video_duration = None
                    data = _chapters_to_moments(chapter_dicts, video_duration)
                    data_resolved = True

        # Components that build from synthesis/meta, not extraction data
        _SELF_SUFFICIENT = {"overview", "budget"}
        if not data_resolved and data is None and component not in _SELF_SUFFICIENT:
            available = list(extraction.keys()) if extraction else []
            logger.warning(
                "No data for tab id=%r, dataSource=%r — not in extraction/enrichment. "
                "Available extraction keys: %s",
                tab_id, data_source, available,
            )

        assembler = ASSEMBLER_REGISTRY.get(component, assemble_display_section)
        tab_with_hints = {**raw_tab, "_primary_tag": primary_tag,
                          "_synthesis": synthesis, "_video_meta": video_meta}

        try:
            props = assembler(tab_with_hints, data, extraction, enrichment)
        except Exception as e:
            logger.warning(
                "TAB DROPPED: id=%r, component=%r, dataSource=%r — assembler raised %s: %s",
                tab_id, component, data_source, type(e).__name__, e,
            )
            props = None

        if props is not None and not _validate_assembled_props(component, props):
            logger.warning(
                "TAB DROPPED: id=%r, component=%r — failed validation",
                tab_id, component,
            )
            props = None

        if props is not None and frames:
            for key in ("items", "spots", "steps", "images", "snippets",
                        "comparisons", "exercises"):
                if key in props and isinstance(props[key], list):
                    inject_frame_thumbnails(
                        props[key],
                        frames,
                        all_frames=all_frames,
                        frame_descriptions=frame_descriptions,
                    )

        if props is None:
            if data_resolved or data is not None:
                data_summary = (
                    f"list[{len(data)}]" if isinstance(data, list)
                    else f"dict(keys={list(data.keys())})" if isinstance(data, dict)
                    else repr(type(data).__name__)
                ) if data is not None else "None"
                logger.warning(
                    "TAB DROPPED: id=%r, component=%r, dataSource=%r — "
                    "assembler returned None (data was %s)",
                    tab_id, component, data_source, data_summary,
                )
            continue

        assembled_tabs.append({
            "id": tab_id,
            "label": raw_tab.get("label", tab_id),
            "emoji": raw_tab.get("emoji", ""),
            "component": component,
            "props": props,
            "goal": raw_tab.get("goal", ""),
            "crossTabLinks": [],
        })

    # Guarantee overview is present and first — must run before cross-tab link
    # resolution so the overview participates in link rules (overview → X).
    _ensure_overview_first(
        assembled_tabs, synthesis, video_meta, extraction, enrichment, primary_tag,
    )

    # Resolve cross-tab links. ``outboundLinks`` on each source tab carries
    # Plan-generated CTA labels in source language; cross_tab.py uses them
    # as link text and falls back to the target tab's own label when an
    # entry is missing.
    all_assembled_tab_ids = {t["id"] for t in assembled_tabs}
    plan_outbound_by_tab: dict[str, dict[str, str]] = {}
    for raw_tab in raw_tabs:
        if not isinstance(raw_tab, dict):
            continue
        tid = raw_tab.get("id", "")
        links_map = raw_tab.get("outboundLinks")
        if isinstance(tid, str) and tid and isinstance(links_map, dict):
            plan_outbound_by_tab[tid] = {
                k: v for k, v in links_map.items()
                if isinstance(k, str) and isinstance(v, str)
            }

    globally_linked: set[str] = set()
    for tab in assembled_tabs:
        links = resolve_cross_tab_links(
            tab_id=tab["id"],
            all_tab_ids=all_assembled_tab_ids,
            component=tab.get("component"),
            all_tabs=assembled_tabs,
            primary_tag=primary_tag,
            outbound_links=plan_outbound_by_tab.get(tab["id"]),
        )
        deduped = []
        for link in links:
            target = link["targetTab"]
            if target not in globally_linked:
                deduped.append(link)
                globally_linked.add(target)
        tab["crossTabLinks"] = deduped

    _validate_domain_requirements(assembled_tabs, primary_tag)

    # Conditional gallery auto-append
    _gallery_source = gallery_frames if gallery_frames else frames
    if _gallery_source and len(_gallery_source) > 0:
        gallery_images = []
        non_generic_count = 0
        for f in sorted(_gallery_source, key=lambda x: x.get("timestamp", 0)):
            ts = f.get("timestamp", 0)
            mins = int(ts) // 60
            secs = int(ts) % 60
            caption = f"Moment at {mins}:{secs:02d}"
            if frame_descriptions:
                desc = find_description_for_frame(f, frame_descriptions)
                if desc and desc.get("content"):
                    caption = desc["content"]
            if caption.startswith("Moment at") and f.get("ocr_text"):
                caption = f.get("ocr_text", caption)

            if not caption.startswith("Moment at"):
                non_generic_count += 1

            gallery_images.append({
                "url": f.get("s3_url", ""),
                "caption": caption,
                "timestamp": ts,
                "thumbnailUrl": f.get("s3_url", ""),
                **({"s3Key": f["s3_key"]} if f.get("s3_key") else {}),
            })

        # Gallery is the lowest-signal tab on the rail — auto-append only when
        # captions are largely non-generic (≥70%, was 50%) and we have enough
        # frames to feel like a real gallery, not a 3-photo afterthought. Also
        # skip for content types where a frame strip never adds value:
        # podcast/narrative/music are mostly talking-head footage; pure audio
        # books, lectures with one slide, etc. drown the page in noise.
        has_enough_frames = len(gallery_images) >= 10
        has_good_captions = non_generic_count >= len(gallery_images) * 0.7
        _NO_GALLERY_DOMAINS = {"narrative", "music"}
        _domain_blocked = primary_tag in _NO_GALLERY_DOMAINS
        if (gallery_images and has_enough_frames and has_good_captions
                and not _domain_blocked):
            layout = "grid" if len(gallery_images) > 10 else "carousel"
            assembled_tabs.append({
                "id": "frames-gallery",
                "label": "Visual Moments",
                "emoji": "\U0001f5bc\ufe0f",
                "component": "gallery",
                "props": {
                    "images": gallery_images,
                    "layout": layout,
                    "enableLightbox": True,
                    "onImageClick": "seek",
                },
                "goal": "Browse key visual moments from the video",
                "crossTabLinks": [],
            })

    _post_process_tabs(assembled_tabs)

    # Minimum 3-tab guarantee: add fallback tabs if needed
    if len(assembled_tabs) < 3:
        existing_components = {t.get("component", "") for t in assembled_tabs}
        existing_ids = {t["id"] for t in assembled_tabs}
        fallbacks = build_fallback_candidates(
            synthesis, video_meta, existing_components, existing_ids,
        )
        for fb in fallbacks:
            if len(assembled_tabs) >= 3:
                break
            component = fb.get("component", "")
            if not _validate_assembled_props(component, fb.get("props", {})):
                continue
            assembled_tabs.append(fb)
            logger.info(
                "[assembly] Fallback tab added: id=%r, component=%r",
                fb["id"], component,
            )

        if len(assembled_tabs) < 3:
            logger.warning(
                "[assembly] Could not reach 3 tabs even with fallbacks (got %d)",
                len(assembled_tabs),
            )

    # Annotate the overview with the final tab count — must run after all
    # additions (cross-tab links, gallery auto-append, fallback candidates)
    # so the "Items" stat reflects what the user actually sees.
    _annotate_overview_item_count(assembled_tabs)

    # Assembly summary
    planned_ids = [t.get("id", "?") for t in raw_tabs if isinstance(t, dict)]
    assembled_ids = {t["id"] for t in assembled_tabs}
    dropped_ids = [tid for tid in planned_ids if tid not in assembled_ids]
    if dropped_ids:
        logger.warning(
            "[assembly] Assembled %d/%d tabs, dropped: %s",
            len(assembled_tabs), len(planned_ids), dropped_ids,
        )
    else:
        logger.info("[assembly] Assembled %d/%d tabs (none dropped)", len(assembled_tabs), len(planned_ids))

    return {"meta": meta, "tabs": assembled_tabs}
