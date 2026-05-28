"""Assembler functions — one per interactive component type.

Signature: (tab, data, extraction, enrichment) -> props dict | None
Returning None means the tab should be dropped (no data).
"""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Category-like front values that indicate flash_deck front corruption
_CATEGORY_FRONTS = frozenset({
    "chef_tip", "pro_tip", "technique", "tip", "fact", "trivia",
    "note", "insight", "key_point", "highlight", "warning",
    "method", "rule", "principle", "concept", "definition",
})


# Domain emoji for the overview hero — matches domain identity at a glance.
_DOMAIN_EMOJI: dict[str, str] = {
    "learning":  "🧠",
    "tech":      "💻",
    "food":      "🍳",
    "fitness":   "💪",
    "music":     "🎵",
    "travel":    "✈️",
    "review":    "⭐",
    "project":   "🔨",
    "language":  "🗣️",
    "science":   "🔬",
    "narrative": "🎬",
    "finance":   "💰",
}

# Fields across domains that can contribute to the overview "Tips" section.
_TIP_FIELDS: tuple[str, ...] = (
    "tips", "savingTips", "transportationTips", "accommodationTips",
    "formTips", "safetyTips", "proTips", "studyTips",
)


# ─────────────────────────────────────────────────────
# Normaliser helpers
# ─────────────────────────────────────────────────────


_SPOT_PASSTHROUGH_FIELDS: tuple[str, ...] = (
    "emoji", "cost", "duration", "mapQuery", "tips", "thumbnailUrl", "s3Key",
    "pronunciation", "timestamp",
)


def _normalize_to_spot(item: dict) -> dict | None:
    """Normalize diverse dict shapes to spot format {name, description, emoji}.

    Returns None when the item lacks a non-empty name, or has only a name with
    no descriptive/passthrough content — such entries render as empty cards in
    the spot_explorer UI.
    """
    name_raw = (item.get("name") or item.get("title") or item.get("phrase")
                or item.get("word") or item.get("aspect") or item.get("label") or "")
    name = str(name_raw).strip()
    if not name:
        return None

    desc_raw = (item.get("description") or item.get("detail") or item.get("definition")
                or item.get("explanation") or item.get("translation") or item.get("context") or "")
    description = str(desc_raw).strip()

    result: dict = {"name": name, "description": description}
    has_passthrough = False
    for field in _SPOT_PASSTHROUGH_FIELDS:
        if field not in item:
            continue
        value = item[field]
        if value is None or value == "":
            continue
        result[field] = value
        has_passthrough = True

    if not description and not has_passthrough:
        return None
    return result


def _first_competitor_name(comparisons: list[dict]) -> str:
    """Extract the first non-empty competitorName from comparison rows."""
    for c in comparisons:
        name = c.get("competitorName", "")
        if name:
            return str(name)
    return ""


def _normalize_comparison(item: dict) -> dict:
    """Normalize a comparison item to {feature, thisProduct, competitor}."""
    if "thisProduct" in item:
        return item  # already in correct shape
    return {
        "feature": item.get("feature", ""),
        "thisProduct": item.get("left", ""),
        "competitor": item.get("right", ""),
        "competitorName": item.get("competitorName", ""),
    }


def _normalize_step(item: dict, index: int) -> dict:
    """Normalize a step item, converting timestamp-shaped data if needed."""
    instruction = (
        item.get("instruction")
        or item.get("title")
        or item.get("label")
        or item.get("name")
        or item.get("text")
        or item.get("description")
        or item.get("detail")
        or ""
    )
    tips = item.get("tips")
    if not tips and item.get("detail") and item.get("detail") != instruction:
        tips = item.get("detail")
    return {
        "number": item.get("number", index + 1),
        "instruction": instruction,
        "timestamp": item.get("timestamp") or item.get("seconds"),
        "duration": item.get("duration"),
        "tips": tips,
        **({"thumbnailUrl": item["thumbnailUrl"]} if item.get("thumbnailUrl") else {}),
        **({"s3Key": item["s3Key"]} if item.get("s3Key") else {}),
    }


def _to_flash_card(item: dict) -> dict:
    """Convert a domain object to {front, back, emoji} flash card format.

    Card backs concatenate raw values without English category prefixes
    ("Form: ", "Duration: ", "Level: ", "Modifications: ", "Example: ").
    The card's ``front`` already carries the term/name — the back just
    needs the explanation content, and prefix labels would leak English
    into non-English flashcards. Values are joined by " · " so the
    structure is still visible.
    """
    if "front" in item and "back" in item:
        return item
    if "name" in item and "definition" in item:
        return {"front": item["name"], "back": item["definition"], "emoji": item.get("emoji")}
    if "name" in item and ("formCues" in item or "duration" in item):
        back_parts: list[str] = []
        if item.get("formCues"):
            cues = item["formCues"]
            back_parts.append(", ".join(cues) if isinstance(cues, list) else str(cues))
        if item.get("duration"):
            back_parts.append(str(item["duration"]))
        if item.get("difficulty"):
            back_parts.append(str(item["difficulty"]))
        if item.get("modifications"):
            mods = item["modifications"]
            if isinstance(mods, list) and mods:
                back_parts.append(", ".join(mods))
        return {
            "front": item["name"],
            "back": " · ".join(p for p in back_parts if p) or item.get("description", ""),
            "emoji": item.get("emoji"),
        }
    if "name" in item:
        return {"front": item["name"], "back": item.get("description") or item.get("text") or "", "emoji": item.get("emoji")}
    if "word" in item:
        back_parts = [item.get("definition") or ""]
        if item.get("pronunciation"):
            back_parts.append(f"({item['pronunciation']})")
        if item.get("example"):
            back_parts.append(str(item["example"]))
        return {"front": item["word"], "back": " ".join(filter(None, back_parts)), "emoji": item.get("emoji")}
    if "term" in item:
        return {"front": item["term"], "back": item.get("definition") or item.get("description") or "", "emoji": item.get("emoji")}
    if "title" in item:
        return {"front": item["title"], "back": item.get("description") or item.get("text") or "", "emoji": item.get("emoji")}
    if "text" in item and "front" not in item:
        return {"front": item.get("type", ""), "back": item["text"], "emoji": item.get("emoji")}
    if "aspect" in item and "detail" in item:
        return {"front": item["aspect"], "back": item["detail"], "emoji": item.get("emoji")}
    if "fact" in item:
        return {"front": item["fact"], "back": item.get("explanation") or item.get("detail") or "", "emoji": item.get("emoji")}
    return item


def _seconds_to_time_str(seconds: int) -> str:
    """Convert seconds to M:SS or H:MM:SS time string."""
    mins, secs = divmod(seconds, 60)
    hours, mins = divmod(mins, 60)
    return f"{hours}:{mins:02d}:{secs:02d}" if hours else f"{mins}:{secs:02d}"


def _normalize_code_snippet(item: Any) -> dict | None:
    """Normalize diverse code snippet shapes to {code, language, explanation}."""
    if isinstance(item, str):
        stripped = item.strip()
        return {"code": stripped, "language": "text", "explanation": ""} if stripped else None
    if not isinstance(item, dict):
        return None
    code = item.get("code") or item.get("snippet") or item.get("example") or ""
    if not code:
        return None
    return {
        "code": code,
        "language": item.get("language") or item.get("lang") or "text",
        "explanation": item.get("explanation") or item.get("description") or item.get("detail") or "",
        "filename": item.get("filename") or None,
        "timestamp": item.get("timestamp"),
    }


def _coerce_int(value: Any) -> int | None:
    """Parse int or return None on failure."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _normalize_moment_item(item: Any, index: int) -> dict | None:
    """Normalize a moment/clip item to {label, time, seconds, endSeconds?, ...}.

    Unified shape for MomentTrack: points (no endSeconds) and spans (with endSeconds).
    Accepts the legacy field names from TimelineExplorer.entries and ClipPlayerInteractive.clips.
    """
    if isinstance(item, str):
        stripped = item.strip()
        return {"label": stripped, "time": "0:00", "seconds": 0} if stripped else None
    if not isinstance(item, dict):
        return None

    description = item.get("description")
    label_raw = (
        item.get("label")
        or item.get("title")
        or item.get("name")
        or (description[:60] if isinstance(description, str) and description else None)
        or f"Moment {index + 1}"
    )

    seconds = _coerce_int(item.get("seconds"))
    if seconds is None:
        for key in ("startSeconds", "timestamp", "start_time", "startTime"):
            seconds = _coerce_int(item.get(key))
            if seconds is not None:
                break
    if seconds is None:
        seconds = 0

    end_seconds = None
    for key in ("endSeconds", "end_seconds", "endTimestamp", "end_time", "endTime"):
        end_seconds = _coerce_int(item.get(key))
        if end_seconds is not None:
            break
    if end_seconds is not None and end_seconds <= seconds + 1:
        end_seconds = None

    time_str = item.get("time") or _seconds_to_time_str(seconds)

    normalized: dict[str, Any] = {
        "label": str(label_raw),
        "time": time_str,
        "seconds": seconds,
    }
    if end_seconds is not None:
        normalized["endSeconds"] = end_seconds
    for key in ("description", "mood", "emoji", "speaker", "thumbnailUrl", "s3Key"):
        value = item.get(key)
        if value is not None and value != "":
            normalized[key] = value
    tags = item.get("tags")
    if isinstance(tags, list) and tags:
        normalized["tags"] = [str(t) for t in tags if t is not None]
    return normalized


def _normalize_exercise(item: Any) -> dict | None:
    """Normalize exercise to {name, emoji, formCues[], ...}."""
    if not isinstance(item, dict):
        return None
    name = item.get("name") or item.get("title") or item.get("exercise") or "Exercise"
    form_cues = item.get("formCues") or item.get("form_cues") or []
    if isinstance(form_cues, str):
        form_cues = [form_cues] if form_cues.strip() else []
    modifications = item.get("modifications") or []
    if isinstance(modifications, str):
        modifications = [modifications] if modifications.strip() else []
    result: dict[str, Any] = {
        "name": str(name),
        "emoji": item.get("emoji") or "💪",
        "formCues": form_cues,
        "modifications": modifications,
    }
    for key in ("sets", "reps", "duration", "rest", "difficulty", "timestamp", "description"):
        if item.get(key) is not None:
            result[key] = item[key]
    return result


def _normalize_quiz_question(item: Any) -> dict | None:
    """Normalize quiz question to {question, options[], correctIndex, explanation}."""
    if not isinstance(item, dict):
        return None
    question = item.get("question") or item.get("text") or ""
    if not question:
        return None
    options = item.get("options") or item.get("choices") or []
    if not isinstance(options, list):
        return None
    options = [str(o) for o in options if o is not None]
    if len(options) < 2:
        return None
    correct_index = item.get("correctIndex") if item.get("correctIndex") is not None else item.get("correct_index")
    if correct_index is None:
        correct_index = 0
    try:
        correct_index = int(correct_index)
    except (ValueError, TypeError):
        correct_index = 0
    correct_index = max(0, min(correct_index, len(options) - 1))
    return {
        "question": str(question),
        "options": options,
        "correctIndex": correct_index,
        "explanation": str(item.get("explanation") or ""),
    }


def _normalize_scenario_option(opt: Any) -> dict | None:
    """Normalize a single scenario option."""
    if isinstance(opt, str):
        return {"text": opt, "correct": False, "explanation": ""} if opt.strip() else None
    if isinstance(opt, dict):
        text = opt.get("text") or opt.get("label") or ""
        if not text:
            return None
        return {
            "text": str(text),
            "correct": bool(opt.get("correct", False)),
            "explanation": str(opt.get("explanation") or ""),
        }
    return None


def _normalize_scenario_item(item: Any) -> dict | None:
    """Normalize scenario to {question, options[]}."""
    if not isinstance(item, dict):
        return None
    question = item.get("question") or item.get("situation") or item.get("text") or ""
    if not question:
        return None
    raw_options = item.get("options") or item.get("choices") or []
    if not isinstance(raw_options, list):
        return None
    options = [o for o in (_normalize_scenario_option(opt) for opt in raw_options) if o is not None]
    if len(options) < 2:
        return None
    return {"question": str(question), "options": options}


def _chapters_to_moments(chapters: list[dict], video_duration: int | None = None) -> list[dict]:
    """Convert yt-dlp chapters to MomentTrack item format with endSeconds spans.

    Each chapter becomes a span: endSeconds is the next chapter's start minus 1.
    The final chapter uses video_duration - 1 when available.
    """
    items: list[dict] = []
    for i, ch in enumerate(chapters):
        start = _coerce_int(ch.get("start_time")) or 0
        next_start: int | None = None
        if i + 1 < len(chapters):
            next_start = _coerce_int(chapters[i + 1].get("start_time"))
        elif video_duration is not None:
            next_start = int(video_duration)
        end_seconds = next_start - 1 if next_start is not None and next_start > start + 1 else None
        entry: dict[str, Any] = {
            "time": _seconds_to_time_str(start),
            "seconds": start,
            "label": ch.get("title", ""),
            "mood": "chapter",
        }
        if end_seconds is not None:
            entry["endSeconds"] = end_seconds
        items.append(entry)
    return items


# ─────────────────────────────────────────────────────
# Assembler Functions
# ─────────────────────────────────────────────────────


# SpotExplorer is a search/filter/browse UI — a single spot renders as a
# degenerate explorer (no filters useful, no comparisons). When a tab can only
# produce one valid spot, dropping it lets `build_fallback_candidates` in
# core.py surface the content via overview/info_grid instead, which is the
# better UX for sparse inputs.
_MIN_SPOTS = 2


def assemble_spot_explorer(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Flatten TravelDay[] to SpotItem[] with section groupings.

    Every spot passes through `_normalize_to_spot`, which drops entries lacking
    a non-empty name or any descriptive/passthrough content. Bare-string input
    is rejected — extraction should produce structured `{name, description}`
    dicts; string arrays are almost always a symptom of keyword-list pollution
    via cross-domain fallback. Requires `_MIN_SPOTS` valid spots to ship; below
    that, the tab is dropped and the fallback layer (overview/info_grid) takes
    over so the content still surfaces.
    """
    if not isinstance(data, list) or len(data) == 0:
        return None

    first = data[0] if isinstance(data[0], dict) else {}
    if ("day" in first or "city" in first) and "spots" in first:
        all_spots: list = []
        sections: list = []
        for day in data:
            if not isinstance(day, dict):
                continue
            label = f"Day {day.get('day', '?')}"
            if day.get("city"):
                label += f": {day['city']}"
            day_spots_raw = day.get("spots", [])
            if not isinstance(day_spots_raw, list):
                continue
            day_spots_clean = [
                spot for spot in (
                    _normalize_to_spot(s) for s in day_spots_raw if isinstance(s, dict)
                ) if spot is not None
            ]
            if not day_spots_clean:
                continue
            start = len(all_spots)
            sections.append({
                "label": label,
                "spotIndices": list(range(start, start + len(day_spots_clean))),
            })
            all_spots.extend(day_spots_clean)
        if len(all_spots) < _MIN_SPOTS:
            return None
        return {"spots": all_spots, "sections": sections}

    normalized = [
        spot for spot in (
            _normalize_to_spot(item) for item in data if isinstance(item, dict)
        ) if spot is not None
    ]
    if len(normalized) < _MIN_SPOTS:
        return None
    return {"spots": normalized}


def assemble_moment_track(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Unified MomentTrack assembler for points and spans.

    Replaces legacy assemble_timeline (points) and assemble_clip_player (spans).
    Items keep endSeconds only when the LLM marked the moment as a replayable
    highlight worth re-watching.
    """
    if not isinstance(data, list) or len(data) < 1:
        return None
    items = [
        m for m in (_normalize_moment_item(item, i) for i, item in enumerate(data))
        if m is not None
    ]
    return {"items": items} if items else None


def assemble_code_explorer(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    snippets = [s for s in (_normalize_code_snippet(item) for item in data) if s is not None]
    if not snippets:
        return None
    return {"snippets": snippets}


def _has_pair_side(value: Any) -> bool:
    """A comparison side is "present" when it carries any non-empty content.

    Numeric zero is legitimate content (a free-tier product priced at $0, a
    "0 GB" storage row), so test for ``None`` and empty-after-strip explicitly
    rather than relying on Python truthiness. The prior ``or ""`` coercion
    dropped rows whose numeric side was 0/False — exactly the kind of
    quantitative comparison this component is supposed to surface.
    """
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, bool):
        # Booleans are valid (e.g. "supports HDR: True vs False"). True/False
        # both count as present.
        return True
    if isinstance(value, (int, float)):
        # Any numeric value is present — including 0 and 0.0.
        return True
    # Lists / dicts: present if non-empty.
    if isinstance(value, (list, dict)):
        return len(value) > 0
    # Unknown shape — coerce to string and check.
    return str(value).strip() != ""


def _is_real_comparison_pair(row: dict) -> bool:
    """A row counts only if BOTH sides carry content. Single-side rows are
    just info_grid in disguise and degrade the comparison UX — they render
    as half-empty rows next to the real pairs."""
    return _has_pair_side(row.get("thisProduct")) and _has_pair_side(row.get("competitor"))


# Comparison tabs need at least two real pairs to justify the side-by-side
# layout. A single pair renders as an info_grid in disguise and was the
# audited "comparison with one row" failure mode — fall through to None so
# the caller can route the data into info_grid / flash_deck instead.
_MIN_COMPARISON_ROWS = 2


def assemble_comparison(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Build comparison props with strict pair requirements.

    Requires at least 2 rows where BOTH sides have content — otherwise the
    output is the audited "video title as column header / empty third column"
    failure mode. When the LLM produced single-sided items (concepts with no
    competitor), this routes through to None so the data can flow into
    info_grid or flash_deck via the fallback layer instead.

    The leftLabel/rightLabel are only set when the data is actually a product
    review with an explicit competitor — never from the video title.
    """
    review_data = extraction.get("review") if isinstance(extraction, dict) else None
    product_name: str | None = None
    if isinstance(review_data, dict):
        candidate = review_data.get("product")
        if isinstance(candidate, str) and candidate.strip():
            product_name = candidate.strip()

    pros: list[str] = []
    cons: list[str] = []
    rows: list[dict] = []

    if isinstance(data, dict):
        pros = list(data.get("pros") or [])
        cons = list(data.get("cons") or [])
        raw_rows = data.get("comparisons") or []
        rows = [_normalize_comparison(c) for c in raw_rows if isinstance(c, dict)]
    elif isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            if "feature" in item and ("thisProduct" in item or "competitor" in item):
                rows.append(_normalize_comparison(item))

    rows = [
        r for r in rows
        if str(r.get("feature") or "").strip() and _is_real_comparison_pair(r)
    ]

    # When the LLM tagged winners on real-pair rows but didn't emit pros/cons
    # explicitly, derive them from the winner field. Keeps the "Go for it /
    # Skip it" recommendation section populated on review tabs that focus on
    # the table rather than separately listing pros and cons.
    if rows and not pros and not cons:
        for row in rows:
            feature = str(row.get("feature") or "").strip()
            if not feature:
                continue
            winner = str(row.get("winner") or "").strip().lower()
            if winner == "left":
                pros.append(feature)
            elif winner == "right":
                cons.append(feature)

    # Enforce the documented contract: a comparison tab needs either ≥2 real
    # pairs OR a populated pros/cons set. A lone row with no pros/cons is the
    # "info_grid in disguise" failure mode the refactor was supposed to close.
    if len(rows) < _MIN_COMPARISON_ROWS and not pros and not cons:
        return None

    competitor_name = _first_competitor_name(rows) if rows else ""

    return {
        "pros": pros,
        "cons": cons,
        "comparisons": rows,
        "leftLabel": product_name or "",
        "rightLabel": competitor_name,
    }


_INFO_KEY_FIELDS: tuple[str, ...] = (
    "key", "name", "title", "label", "term", "word", "phrase",
    "aspect", "role", "type", "fact", "concept",
)
_INFO_VALUE_FIELDS: tuple[str, ...] = (
    "value", "definition", "description", "detail", "explanation",
    "text", "translation", "answer", "meaning",
)
_INFO_EVIDENCE_FIELDS: tuple[str, ...] = (
    "example", "source", "context", "pronunciation", "note",
    "analogy", "quote",
)


def _normalize_info_grid_item(item: Any) -> dict | None:
    """Coerce diverse LLM-emit shapes into {key, value, evidence?, emoji?}.

    Returns None when the item lacks either key OR value — those would render
    as empty cards and are the root cause of the wall-of-empty-grid bug.
    """
    if isinstance(item, str):
        text = item.strip()
        return {"key": text, "value": ""} if text else None
    if not isinstance(item, dict):
        return None

    # Credits-style: {role, name} — role labels the position (key), name
    # identifies who fills it (value). Handle explicitly because both fields
    # fall in the priority key-field list and would otherwise collide.
    role = str(item.get("role") or "").strip()
    name = str(item.get("name") or "").strip()
    if role and name and not any(item.get(f) for f in _INFO_VALUE_FIELDS):
        result: dict[str, Any] = {"key": role, "value": name}
        if item.get("emoji"):
            result["emoji"] = item["emoji"]
        return result

    if "key" in item and "value" in item:
        key_clean = str(item["key"]).strip()
        value_clean = str(item.get("value") or "").strip()
        if not key_clean or not value_clean:
            return None
        result: dict[str, Any] = {"key": key_clean, "value": value_clean}
        if item.get("emoji"):
            result["emoji"] = item["emoji"]
        for ev_field in _INFO_EVIDENCE_FIELDS:
            ev = item.get(ev_field)
            if isinstance(ev, str) and ev.strip():
                result["evidence"] = ev.strip()
                break
        return result

    key_raw = ""
    for field in _INFO_KEY_FIELDS:
        candidate = item.get(field)
        if isinstance(candidate, str) and candidate.strip():
            key_raw = candidate.strip()
            break
    if not key_raw:
        return None

    value_raw = ""
    for field in _INFO_VALUE_FIELDS:
        candidate = item.get(field)
        if isinstance(candidate, str) and candidate.strip():
            value_raw = candidate.strip()
            break
    if not value_raw:
        return None

    result = {"key": key_raw, "value": value_raw}
    if item.get("emoji"):
        result["emoji"] = item["emoji"]

    for ev_field in _INFO_EVIDENCE_FIELDS:
        ev = item.get(ev_field)
        if isinstance(ev, str) and ev.strip() and ev.strip() != value_raw:
            result["evidence"] = ev.strip()
            break

    if item.get("timestamp") is not None:
        result["timestamp"] = item["timestamp"]

    return result


def assemble_info_grid(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Normalize diverse list/dict shapes into InfoGridItem[].

    Drops items that can't produce both a key and a value — they'd render as
    empty cards. If every item is dropped, returns None so the orchestrator
    can route the data through a fallback layer instead of shipping an empty
    grid (the audited "8 empty cards" failure mode).
    """
    if isinstance(data, list) and len(data) >= 1:
        pairs = [
            p for p in (_normalize_info_grid_item(item) for item in data)
            if p is not None
        ]
        return {"items": pairs} if pairs else None
    if isinstance(data, dict) and data:
        pairs = [{"key": str(k), "value": str(v)} for k, v in data.items()
                 if isinstance(v, (str, int, float, bool)) and str(v).strip()]
        return {"items": pairs} if pairs else None
    return None


def assemble_checklist(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None

    items: list[dict] = []
    for item in data:
        if isinstance(item, str):
            items.append({"label": item})
        elif isinstance(item, dict):
            if "name" in item and ("amount" in item or "unit" in item or "displayAmount" in item):
                da = str(item.get("displayAmount", "")).strip()
                if da:
                    items.append({"label": f"{da} {item['name']}", "note": item.get("notes")})
                else:
                    parts: list[str] = []
                    if item.get("amount") and item["amount"] != 0:
                        parts.append(str(item["amount"]))
                    if item.get("unit"):
                        parts.append(str(item["unit"]))
                    parts.append(str(item["name"]))
                    items.append({"label": " ".join(parts), "note": item.get("notes")})
            elif "item" in item:
                items.append({
                    "label": str(item["item"]),
                    "note": item.get("category"),
                    "emoji": "⚠️" if item.get("essential") else None,
                })
            elif "text" in item:
                items.append({"label": str(item["text"]), "note": item.get("notes")})
            elif "title" in item:
                items.append({"label": str(item["title"]), "note": item.get("detail") or item.get("notes")})
            elif "label" in item:
                items.append({"label": str(item["label"]), "note": item.get("note") or item.get("notes")})
            elif "name" in item:
                items.append({"label": str(item["name"]), "note": item.get("notes")})
            else:
                items.append({"label": str(item)})
        else:
            items.append({"label": str(item)})

    return {"items": items}


def assemble_step_player(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    steps = [_normalize_step(item, i) for i, item in enumerate(data) if isinstance(item, dict)]
    if not steps:
        return None
    return {"steps": steps}


def assemble_exercise_tracker(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if isinstance(data, dict):
        raw_exercises = data.get("exercises") or []
        warmup = data.get("warmup") or []
        cooldown = data.get("cooldown") or []
        exercises = [e for e in (_normalize_exercise(item) for item in raw_exercises) if e is not None] if isinstance(raw_exercises, list) else []
        if not exercises and not warmup:
            return None
        props: dict[str, Any] = {"exercises": exercises}
        if warmup:
            props["warmup"] = warmup
        if cooldown:
            props["cooldown"] = cooldown
        return props
    if isinstance(data, list) and len(data) > 0:
        exercises = [e for e in (_normalize_exercise(item) for item in data) if e is not None]
        return {"exercises": exercises} if exercises else None
    return None


def assemble_quiz(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    questions = [q for q in (_normalize_quiz_question(item) for item in data) if q is not None]
    if not questions:
        return None
    return {"questions": questions}


def assemble_flash_deck(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    flat = []
    for item in data:
        if isinstance(item, dict) and "cards" in item and isinstance(item["cards"], list):
            flat.extend(item["cards"])
        else:
            flat.append(item)
    if not flat:
        return None
    cards = [_to_flash_card(item) if isinstance(item, dict) else item for item in flat]
    for card in cards:
        if isinstance(card, dict) and "front" in card and "back" in card:
            front = str(card["front"]).strip().lower().replace(" ", "_")
            if front in _CATEGORY_FRONTS or front.endswith("_tip") or front.endswith("_note"):
                back = str(card.get("back", ""))
                sentences = back.split(". ")
                if sentences and sentences[0]:
                    new_front = sentences[0].rstrip(".")
                    if len(new_front) > 60:
                        words = new_front.split()[:8]
                        new_front = " ".join(words)
                    card["front"] = new_front
    return {"cards": cards}


def assemble_scenario(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    scenarios = [s for s in (_normalize_scenario_item(item) for item in data) if s is not None]
    if not scenarios:
        return None
    return {"scenarios": scenarios}


def assemble_verdict(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, dict):
        return None
    return {
        "badge": data.get("badge", "neutral"),
        "bottomLine": data.get("bottomLine", ""),
        "bestFor": data.get("bestFor", []),
        "notFor": data.get("notFor", []),
    }


def assemble_budget(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if isinstance(data, dict) and data:
        return {
            "total": data.get("total", 0),
            "currency": data.get("currency", "USD"),
            "breakdown": data.get("breakdown") or data.get("costs", []),
            "savingTips": data.get("savingTips") or data.get("saving_tips", []),
        }
    return None


def _extract_level(extraction: dict | None, primary_tag: str) -> str | None:
    """Pull a level/difficulty string from extraction (meta.difficulty, difficulty, level)."""
    if not extraction:
        return None
    domain = extraction.get(primary_tag)
    if not isinstance(domain, dict):
        return None
    meta = domain.get("meta") if isinstance(domain.get("meta"), dict) else None
    for source in (meta, domain):
        if not isinstance(source, dict):
            continue
        for key in ("difficulty", "level"):
            val = source.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip().title()
    return None


def _collect_tips(extraction: dict | None, primary_tag: str, cap: int = 5) -> list[str]:
    """Collect tip-shaped strings from the primary domain across known fields."""
    if not extraction:
        return []
    domain = extraction.get(primary_tag)
    if not isinstance(domain, dict):
        return []
    out: list[str] = []
    for field in _TIP_FIELDS:
        val = domain.get(field)
        if not isinstance(val, list):
            continue
        for item in val:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
            elif isinstance(item, dict):
                text = item.get("tip") or item.get("text") or item.get("description")
                if isinstance(text, str) and text.strip():
                    out.append(text.strip())
            if len(out) >= cap:
                return out
    return out


def assemble_overview(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Build composite overview from synthesis + video metadata + domain data.

    Emits rich fields (title, emoji, subtitle, stats, tips, level) so
    OverviewInteractive renders the hero, stat pills, and collapsible tips —
    not just a bare summary.
    """
    synthesis = tab.get("_synthesis") or {}
    video_meta = tab.get("_video_meta") or {}
    primary_tag = tab.get("_primary_tag", "learning")

    result: dict[str, Any] = {}

    if video_meta.get("title"):
        result["title"] = video_meta["title"]

    result["emoji"] = _DOMAIN_EMOJI.get(primary_tag, "📋")

    if synthesis.get("tldr"):
        result["subtitle"] = synthesis["tldr"]
        result["tldr"] = synthesis["tldr"]

    if synthesis.get("masterSummary"):
        result["masterSummary"] = synthesis["masterSummary"]
    if synthesis.get("keyTakeaways"):
        result["keyTakeaways"] = synthesis["keyTakeaways"]

    stats: list[dict[str, str]] = []
    duration_seconds = video_meta.get("duration")
    if isinstance(duration_seconds, (int, float)) and duration_seconds > 0:
        duration_min = round(duration_seconds / 60)
        stats.append({"label": "Duration", "value": f"{duration_min} min", "emoji": "⏱️"})

    level = _extract_level(extraction, primary_tag)
    if level:
        stats.append({"label": "Level", "value": level, "emoji": "🎯"})
        result["level"] = level

    if stats:
        result["stats"] = stats

    if duration_seconds is not None:
        result["duration"] = duration_seconds
    if video_meta.get("channel"):
        result["channel"] = video_meta["channel"]

    tips = _collect_tips(extraction, primary_tag)
    if tips:
        result["tips"] = tips

    domain_data = extraction.get(primary_tag) if extraction else None
    if isinstance(domain_data, dict):
        for key, value in domain_data.items():
            if value is None or key in result:
                continue
            if isinstance(value, (str, int, float, bool)):
                result[key] = value
            elif isinstance(value, dict):
                for k, v in value.items():
                    if (isinstance(v, (str, int, float, bool)) and v is not None
                            and k not in result):
                        result[k] = v

    # Only the domain emoji was set — no real content to show.
    if set(result.keys()) <= {"emoji"}:
        return None

    return {"data": result}


def assemble_gallery(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    return {"images": data}


def assemble_lyrics_player(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Build lyrics player props from music structure + lyrics."""
    music = data if isinstance(data, dict) and ("structure" in data or "lyrics" in data) else None
    if music is None:
        music = extraction.get("music", {}) if extraction else {}
    if not isinstance(music, dict):
        return None
    structure = music.get("structure", [])
    lyrics = music.get("lyrics", [])
    if not structure and not lyrics:
        return None
    sections: list[dict] = []
    lyric_lines = []
    if isinstance(lyrics, list):
        lyric_lines = [
            {"line": item.get("line", item.get("text", str(item))), "timestamp": item.get("timestamp")}
            if isinstance(item, dict) else {"line": str(item)}
            for item in lyrics
        ]

    if structure and isinstance(structure, list):
        for i, seg in enumerate(structure):
            if not isinstance(seg, dict):
                continue
            seg_start = int(seg.get("timestamp", 0) or 0)
            next_start = int(structure[i + 1].get("timestamp", 999999)) if i + 1 < len(structure) and isinstance(structure[i + 1], dict) else 999999
            seg_lines = [
                l for l in lyric_lines
                if l.get("timestamp") is not None and seg_start <= int(l.get("timestamp") or 0) < next_start
            ]
            sections.append({
                "name": seg.get("name", f"Section {i + 1}"),
                "timestamp": seg_start,
                "lines": seg_lines if seg_lines else [{"line": seg.get("description", "")}],
                "analysis": seg.get("description", ""),
            })
    elif lyric_lines:
        sections.append({"name": "Lyrics", "timestamp": 0, "lines": lyric_lines})

    if not sections:
        return None
    props: dict[str, Any] = {"sections": sections}
    if music.get("artist"):
        props["artist"] = music["artist"]
    return props


def assemble_display_section(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Generic fallback for non-interactive tabs."""
    if data is None:
        return None
    return {"data": data, "tabId": tab.get("id", "")}


# ─────────────────────────────────────────────────────
# Assembler Registry & Component Inference
# ─────────────────────────────────────────────────────

ASSEMBLER_REGISTRY: dict[str, Callable] = {
    "spot_explorer": assemble_spot_explorer,
    "moment_track": assemble_moment_track,
    "code_explorer": assemble_code_explorer,
    "comparison": assemble_comparison,
    "gallery": assemble_gallery,
    "info_grid": assemble_info_grid,
    "checklist": assemble_checklist,
    "step_player": assemble_step_player,
    "exercise_tracker": assemble_exercise_tracker,
    "quiz": assemble_quiz,
    "flash_deck": assemble_flash_deck,
    "scenario": assemble_scenario,
    "lyrics_player": assemble_lyrics_player,
    "verdict": assemble_verdict,
    "budget": assemble_budget,
    "overview": assemble_overview,
    "display_section": assemble_display_section,
}

_TAB_ID_TO_COMPONENT: dict[str, str] = {
    "itinerary": "spot_explorer",
    "spots": "spot_explorer",
    "key_moments": "moment_track",
    "timestamps": "moment_track",
    "highlights": "moment_track",
    "code": "code_explorer",
    "cheat_sheet": "code_explorer",
    "setup": "code_explorer",
    "pros_cons": "comparison",
    "specs": "info_grid",
    "credits": "info_grid",
    "ingredients": "checklist",
    "packing": "checklist",
    "materials": "checklist",
    "tools": "checklist",
    "steps": "step_player",
    "exercises": "exercise_tracker",
    "timer": "exercise_tracker",
    "quizzes": "quiz",
    "flashcards": "flash_deck",
    "concepts": "flash_deck",
    "scenarios": "scenario",
    "gallery": "gallery",
    "lyrics": "lyrics_player",
    "structure": "lyrics_player",
    "verdict": "verdict",
    "budget": "budget",
    "overview": "overview",
}


def infer_component(tab_id: str) -> str:
    """Infer component from tab ID when triage doesn't specify one."""
    return _TAB_ID_TO_COMPONENT.get(tab_id, "display_section")
