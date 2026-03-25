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


# ─────────────────────────────────────────────────────
# Normaliser helpers
# ─────────────────────────────────────────────────────


def _normalize_to_spot(item: dict) -> dict:
    """Normalize diverse dict shapes to spot format {name, description, emoji}."""
    name = item.get("name") or item.get("title") or item.get("aspect") or item.get("label") or ""
    desc = (item.get("description") or item.get("detail") or item.get("definition")
            or item.get("explanation") or "")
    result = {"name": str(name), "description": str(desc)}
    for passthrough in ("emoji", "cost", "duration", "mapQuery", "tips", "thumbnailUrl"):
        if passthrough in item:
            result[passthrough] = item[passthrough]
    return result


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
    if "instruction" in item:
        if "number" not in item:
            item = {**item, "number": index + 1}
        return item
    return {
        "number": index + 1,
        "instruction": item.get("label", ""),
        "timestamp": item.get("seconds"),
        "duration": item.get("duration"),
        "tips": item.get("tips"),
    }


def _to_flash_card(item: dict) -> dict:
    """Convert a domain object to {front, back, emoji} flash card format."""
    if "front" in item and "back" in item:
        return item
    if "name" in item and "definition" in item:
        return {"front": item["name"], "back": item["definition"], "emoji": item.get("emoji")}
    if "name" in item and ("formCues" in item or "duration" in item):
        back_parts = []
        if item.get("formCues"):
            back_parts.append("Form: " + ", ".join(item["formCues"]) if isinstance(item["formCues"], list) else str(item["formCues"]))
        if item.get("duration"):
            back_parts.append(f"Duration: {item['duration']}")
        if item.get("difficulty"):
            back_parts.append(f"Level: {item['difficulty']}")
        if item.get("modifications"):
            mods = item["modifications"]
            if isinstance(mods, list) and mods:
                back_parts.append("Modifications: " + ", ".join(mods))
        return {"front": item["name"], "back": " | ".join(back_parts) or item.get("description", ""), "emoji": item.get("emoji")}
    if "name" in item:
        return {"front": item["name"], "back": item.get("description") or item.get("text") or "", "emoji": item.get("emoji")}
    if "term" in item:
        return {"front": item["term"], "back": item.get("definition") or item.get("description") or "", "emoji": item.get("emoji")}
    if "title" in item:
        return {"front": item["title"], "back": item.get("description") or item.get("text") or "", "emoji": item.get("emoji")}
    if "text" in item and "front" not in item:
        return {"front": item.get("type", "Tip"), "back": item["text"], "emoji": item.get("emoji")}
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


def _normalize_timeline_entry(item: Any, index: int) -> dict | None:
    """Normalize timeline entry to {label, time, seconds}."""
    if isinstance(item, str):
        stripped = item.strip()
        return {"label": stripped, "time": "0:00", "seconds": 0} if stripped else None
    if not isinstance(item, dict):
        return None
    label = (item.get("label") or item.get("title") or item.get("name")
             or item.get("description") or f"Point {index + 1}")
    seconds = item.get("seconds")
    if seconds is None:
        ts = next((v for k in ("timestamp", "start_time", "startTime") if (v := item.get(k)) is not None), 0)
        try:
            seconds = int(ts)
        except (ValueError, TypeError):
            seconds = 0
    else:
        try:
            seconds = int(seconds)
        except (ValueError, TypeError):
            seconds = 0
    time_str = item.get("time") or _seconds_to_time_str(seconds)
    return {"label": str(label), "time": time_str, "seconds": seconds}


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


def _chapters_to_timeline(chapters: list[dict]) -> list[dict]:
    """Convert yt-dlp chapters to timeline entry format."""
    entries = []
    for ch in chapters:
        start = ch.get("start_time", 0)
        seconds = int(start)
        mins, secs = divmod(seconds, 60)
        hours, mins = divmod(mins, 60)
        time_str = f"{hours}:{mins:02d}:{secs:02d}" if hours else f"{mins}:{secs:02d}"
        entries.append({
            "time": time_str,
            "seconds": seconds,
            "label": ch.get("title", ""),
        })
    return entries


# ─────────────────────────────────────────────────────
# Assembler Functions
# ─────────────────────────────────────────────────────


def assemble_spot_explorer(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Flatten TravelDay[] to SpotItem[] with section groupings."""
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
            day_spots = day.get("spots", [])
            if isinstance(day_spots, list):
                start = len(all_spots)
                sections.append({
                    "label": label,
                    "spotIndices": list(range(start, start + len(day_spots))),
                })
                all_spots.extend(day_spots)
        return {"spots": all_spots, "sections": sections} if all_spots else None

    normalized = []
    for item in data:
        if isinstance(item, dict):
            normalized.append(_normalize_to_spot(item))
        elif isinstance(item, str) and item.strip():
            normalized.append({"title": item.strip(), "detail": "", "emoji": ""})
    return {"spots": normalized} if normalized else None


def assemble_timeline(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    entries = [e for e in (_normalize_timeline_entry(item, i) for i, item in enumerate(data)) if e is not None]
    return {"entries": entries} if entries else None


def assemble_code_explorer(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    snippets = [s for s in (_normalize_code_snippet(item) for item in data) if s is not None]
    return {"snippets": snippets} if snippets else None


def assemble_comparison(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if isinstance(data, dict):
        pros = data.get("pros") or []
        cons = data.get("cons") or []
        comparisons = data.get("comparisons") or []
        if pros or cons or comparisons:
            normalized = [_normalize_comparison(c) for c in comparisons if isinstance(c, dict)]
            if not pros and not cons and normalized:
                for c in normalized:
                    feature = c.get("feature", "")
                    if not feature:
                        continue
                    winner = c.get("winner", "")
                    if winner == "left":
                        pros.append(feature)
                    elif winner == "right":
                        cons.append(feature)
                    elif winner == "tie":
                        pass
                    elif c.get("thisProduct") and not c.get("competitor"):
                        pros.append(feature)
            return {"pros": pros, "cons": cons, "comparisons": normalized}

    if isinstance(data, list) and len(data) > 0:
        rows: list[dict] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            if "feature" in item and ("thisProduct" in item or "competitor" in item):
                rows.append(_normalize_comparison(item))
            elif "title" in item and "description" in item:
                rows.append({
                    "feature": item["title"],
                    "thisProduct": item.get("description", ""),
                    "competitor": item.get("code", ""),
                })
            elif "name" in item and "definition" in item:
                rows.append({
                    "feature": f"{item.get('emoji', '')} {item['name']}".strip(),
                    "thisProduct": item.get("definition", ""),
                    "competitor": item.get("example") or item.get("analogy") or "",
                })
            elif "name" in item and "description" in item:
                rows.append({
                    "feature": f"{item.get('emoji', '')} {item['name']}".strip(),
                    "thisProduct": item.get("description", ""),
                    "competitor": "",
                })
            elif "title" in item and "detail" in item:
                rows.append({
                    "feature": f"{item.get('emoji', '')} {item['title']}".strip(),
                    "thisProduct": item.get("detail", ""),
                    "competitor": "",
                })
        if rows:
            return {"pros": [], "cons": [], "comparisons": rows}

    return None


def assemble_info_grid(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if isinstance(data, list) and len(data) >= 1:
        pairs = []
        for item in data:
            if isinstance(item, dict):
                if "key" in item and "value" in item:
                    pairs.append(item)
                elif "name" in item and "value" in item:
                    pairs.append({"key": item["name"], "value": item["value"]})
                elif "label" in item and "value" in item:
                    pairs.append({"key": item["label"], "value": item["value"]})
                elif "label" in item and "description" in item:
                    pairs.append({"key": item["label"], "value": item["description"]})
                elif "name" in item and "description" in item:
                    pairs.append({"key": item["name"], "value": item["description"]})
                elif "role" in item and "name" in item:
                    pairs.append({"key": item["role"], "value": item["name"]})
                elif "type" in item and "text" in item:
                    pairs.append({"key": item["type"], "value": item["text"]})
                else:
                    pairs.append(item)
            elif isinstance(item, str):
                pairs.append({"key": item, "value": ""})
        return {"items": pairs} if pairs else None
    if isinstance(data, dict) and data:
        pairs = [{"key": str(k), "value": str(v)} for k, v in data.items()
                 if isinstance(v, (str, int, float, bool))]
        return {"items": pairs} if pairs else {"data": data}
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

    _TAB_LABELS = {"ingredients": "Ingredients", "packing": "Pack List", "materials": "Materials", "tools": "Tools"}
    tab_label = _TAB_LABELS.get(tab.get("id", ""), tab.get("label", "Checklist"))
    return {"items": items, "tabLabel": tab_label}


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
    return {"questions": questions} if questions else None


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
    return {"scenarios": scenarios} if scenarios else None


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


def assemble_overview(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Build composite overview from synthesis + domain metadata."""
    synthesis = tab.get("_synthesis") or {}
    video_meta = tab.get("_video_meta") or {}
    primary_tag = tab.get("_primary_tag", "learning")

    result: dict[str, Any] = {}

    if synthesis.get("masterSummary"):
        result["masterSummary"] = synthesis["masterSummary"]
    if synthesis.get("keyTakeaways"):
        result["keyTakeaways"] = synthesis["keyTakeaways"]
    if synthesis.get("tldr"):
        result["tldr"] = synthesis["tldr"]

    if video_meta.get("duration"):
        result["duration"] = video_meta["duration"]
    if video_meta.get("channel"):
        result["channel"] = video_meta["channel"]

    domain_data = extraction.get(primary_tag)
    if isinstance(domain_data, dict):
        for key, value in domain_data.items():
            if value is None:
                continue
            if isinstance(value, (str, int, float, bool)):
                result[key] = value
            elif isinstance(value, dict):
                for k, v in value.items():
                    if isinstance(v, (str, int, float, bool)) and v is not None:
                        result[k] = v

    if not result:
        return None
    return {"data": result}


def assemble_gallery(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    return {"images": data}


def assemble_clip_player(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    if not isinstance(data, list) or len(data) < 1:
        return None
    clips = []
    for item in data:
        if isinstance(item, dict):
            label = (item.get("label") or item.get("title") or item.get("name")
                     or item.get("description") or "Clip")
            start_seconds = next((v for k in ("startSeconds", "seconds", "timestamp") if (v := item.get(k)) is not None), 0)
            try:
                start_seconds = int(start_seconds)
            except (ValueError, TypeError):
                start_seconds = 0
            time_str = item.get("time") or _seconds_to_time_str(start_seconds)
            clips.append({
                "label": str(label),
                "timestamp": item.get("timestamp"),
                "startSeconds": start_seconds,
                "time": time_str,
                "mood": item.get("mood"),
                "description": str(item.get("description") or ""),
            })
    return {"clips": clips} if clips else None


def assemble_lyrics_player(
    tab: dict, data: Any, extraction: dict, enrichment: dict | None,
) -> dict | None:
    """Build lyrics player props from music structure + lyrics."""
    music = data if isinstance(data, dict) and ("structure" in data or "lyrics" in data) else None
    if music is None:
        music = extraction.get("music", {})
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
    "timeline": assemble_timeline,
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
    "clip_player": assemble_clip_player,
    "lyrics_player": assemble_lyrics_player,
    "verdict": assemble_verdict,
    "budget": assemble_budget,
    "overview": assemble_overview,
    "display_section": assemble_display_section,
}

_TAB_ID_TO_COMPONENT: dict[str, str] = {
    "itinerary": "spot_explorer",
    "spots": "spot_explorer",
    "key_moments": "timeline",
    "timestamps": "timeline",
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
    "highlights": "clip_player",
    "lyrics": "lyrics_player",
    "structure": "lyrics_player",
    "verdict": "verdict",
    "budget": "budget",
    "overview": "overview",
}


def infer_component(tab_id: str) -> str:
    """Infer component from tab ID when triage doesn't specify one."""
    return _TAB_ID_TO_COMPONENT.get(tab_id, "display_section")
