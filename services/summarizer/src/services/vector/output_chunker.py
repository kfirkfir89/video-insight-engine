"""Per-component output chunker for assembled tab output.

Walks ``assembled_tabs: list[TabEntry-shaped dict]`` and emits one
``OutputChunk`` per natural retrieval unit (one summary, one quiz question,
one comparison row...). Each chunk records the originating tab, component,
and prop path so retrieval results can deep-link back into the UI.

Design rules (authoritative — see ``rag-vector-alignment-plan.md``):

* **Per-component table** — every supported component has an explicit
  rendering rule. Components NOT in ``_COMPONENT_HANDLERS`` emit nothing.
  This is deliberate: silent fallbacks would index button labels, IDs, and
  enum flags as embeddings, polluting retrieval with low-signal noise.
* **<6-word drop** — a chunk whose final text has fewer than 6 whitespace-
  separated tokens is discarded. Below that, embeddings encode incidentals
  (single words, fragments) more than meaning.
* **No code, numbers, timestamps, URLs, raw JSON** — only natural-language
  prose. Code/number-shaped fields are skipped at the per-component layer.
* **``display_section`` whitelist** — for the catch-all generic component,
  only values under a fixed set of "prose-shaped" keys are flattened.
  Anything else (IDs, mapQuery strings, button labels) is silently dropped.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Callable

_MIN_WORDS = 6

_DISPLAY_SECTION_WHITELIST = frozenset(
    [
        "text",
        "description",
        "summary",
        "explanation",
        "content",
        "analysis",
        "caption",
        "label",
        "instruction",
        "tip",
        "note",
    ]
)

_WORD_SPLITTER = re.compile(r"\s+")


@dataclass
class OutputChunk:
    """A retrievable chunk extracted from one prop path of one tab."""

    text: str
    tab_id: str
    tab_component: str
    prop_path: str


# ──────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────


def chunk_assembled_tabs(tabs: list[dict]) -> list[OutputChunk]:
    """Convert assembled tabs into a flat list of retrievable text chunks."""
    chunks: list[OutputChunk] = []
    for tab in tabs:
        if not isinstance(tab, dict):
            continue
        tab_id = tab.get("id") or ""
        component = tab.get("component") or ""
        if not tab_id or not component:
            continue

        handler = _COMPONENT_HANDLERS.get(component)
        if handler is None:
            # Unknown component — emit nothing. Add it to the registry first.
            continue

        props = tab.get("props") or {}
        if not isinstance(props, dict):
            continue

        for chunk in handler(tab_id, component, props):
            if _meets_minimum_length(chunk.text):
                chunks.append(chunk)

    return chunks


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────


def _meets_minimum_length(text: str) -> bool:
    return len(_WORD_SPLITTER.split(text.strip())) >= _MIN_WORDS if text else False


def _norm(value: Any) -> str:
    """Coerce a raw prop value to a stripped string; return '' for None/non-str."""
    if isinstance(value, str):
        return value.strip()
    return ""


def _join_clean(parts: list[str], sep: str = " ") -> str:
    """Join non-empty parts with ``sep``, collapsing internal whitespace."""
    cleaned = [_WORD_SPLITTER.sub(" ", p.strip()) for p in parts if p and p.strip()]
    return sep.join(cleaned)


def _make(text: str, tab_id: str, component: str, prop_path: str) -> OutputChunk:
    return OutputChunk(text=text, tab_id=tab_id, tab_component=component, prop_path=prop_path)


# ──────────────────────────────────────────────────────────────────────
# Per-component handlers — each returns a generator of OutputChunk
# (callers filter by minimum length).
# ──────────────────────────────────────────────────────────────────────


def _h_overview(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    master = _norm(props.get("masterSummary"))
    if master:
        out.append(_make(master, tab_id, component, "masterSummary"))
    for i, item in enumerate(props.get("keyTakeaways") or []):
        text = _norm(item)
        if text:
            out.append(_make(text, tab_id, component, f"keyTakeaways[{i}]"))
    tldr = _norm(props.get("tldr"))
    if tldr:
        out.append(_make(tldr, tab_id, component, "tldr"))
    return out


def _h_spot_explorer(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, spot in enumerate(props.get("spots") or []):
        if not isinstance(spot, dict):
            continue
        name = _norm(spot.get("name"))
        description = _norm(spot.get("description"))
        tips = spot.get("tips")
        tips_text = ""
        if isinstance(tips, list):
            tips_text = _join_clean([_norm(t) for t in tips], sep=" ")
        elif isinstance(tips, str):
            tips_text = _norm(tips)
        parts = []
        if name:
            parts.append(f"{name}.")
        if description:
            parts.append(description)
        if tips_text:
            parts.append(f"Tips: {tips_text}")
        text = _join_clean(parts)
        if text:
            out.append(_make(text, tab_id, component, f"spots[{i}]"))
    return out


def _h_timeline(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    """Legacy — superseded by ``moment_track``. Kept so historical tabs that
    were serialized with ``component="timeline"`` still chunk correctly on
    reprocess. Safe to remove once production data no longer contains it.
    """
    out: list[OutputChunk] = []
    for i, entry in enumerate(props.get("entries") or []):
        if not isinstance(entry, dict):
            continue
        timestamp = _norm(entry.get("timestamp"))
        label = _norm(entry.get("label"))
        if not label:
            continue
        text = f"At {timestamp}: {label}" if timestamp else label
        out.append(_make(text, tab_id, component, f"entries[{i}]"))
    return out


def _h_moment_track(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    """Unified replacement for legacy ``timeline`` and ``clip_player``.

    Pulls only prose fields (``label`` and ``description``). Numeric
    ``seconds`` / ``endSeconds`` and pre-formatted ``time`` strings are
    intentionally excluded — embedding them poisons retrieval with low-signal
    numbers and clock-shaped tokens.
    """
    out: list[OutputChunk] = []
    for i, item in enumerate(props.get("items") or []):
        if not isinstance(item, dict):
            continue
        label = _norm(item.get("label"))
        description = _norm(item.get("description"))
        if not (label or description):
            continue
        text = f"{label}. {description}" if (label and description) else (label or description)
        out.append(_make(text, tab_id, component, f"items[{i}]"))
    return out


def _h_code_explorer(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, snippet in enumerate(props.get("snippets") or []):
        if not isinstance(snippet, dict):
            continue
        explanation = _norm(snippet.get("explanation"))
        if explanation:
            out.append(_make(explanation, tab_id, component, f"snippets[{i}].explanation"))
    return out


def _h_comparison(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, p in enumerate(props.get("pros") or []):
        text = _norm(p)
        if text:
            out.append(_make(text, tab_id, component, f"pros[{i}]"))
    for i, c in enumerate(props.get("cons") or []):
        text = _norm(c)
        if text:
            out.append(_make(text, tab_id, component, f"cons[{i}]"))
    for i, row in enumerate(props.get("comparisons") or []):
        if not isinstance(row, dict):
            continue
        feature = _norm(row.get("feature"))
        this_p = _norm(row.get("thisProduct"))
        competitor = _norm(row.get("competitor"))
        if feature and (this_p or competitor):
            text = f"{feature}: {this_p} vs {competitor}".strip()
            out.append(_make(text, tab_id, component, f"comparisons[{i}]"))
    return out


def _h_info_grid(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, item in enumerate(props.get("items") or []):
        if not isinstance(item, dict):
            continue
        key = _norm(item.get("key"))
        value = _norm(item.get("value"))
        if key and value:
            out.append(_make(f"{key}: {value}", tab_id, component, f"items[{i}]"))
    return out


def _h_checklist(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, item in enumerate(props.get("items") or []):
        if not isinstance(item, dict):
            continue
        label = _norm(item.get("label"))
        note = _norm(item.get("note"))
        if not label:
            continue
        text = f"{label}. {note}" if note else label
        out.append(_make(text, tab_id, component, f"items[{i}]"))
    return out


def _h_step_player(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, step in enumerate(props.get("steps") or []):
        if not isinstance(step, dict):
            continue
        instruction = _norm(step.get("instruction"))
        tips = step.get("tips")
        tips_text = ""
        if isinstance(tips, list):
            tips_text = _join_clean([_norm(t) for t in tips])
        elif isinstance(tips, str):
            tips_text = _norm(tips)
        if not instruction:
            continue
        text = f"{instruction} Tips: {tips_text}" if tips_text else instruction
        out.append(_make(text, tab_id, component, f"steps[{i}]"))
    return out


def _h_exercise_tracker(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, ex in enumerate(props.get("exercises") or []):
        if not isinstance(ex, dict):
            continue
        name = _norm(ex.get("name"))
        form_cues = ex.get("formCues")
        cues_text = ""
        if isinstance(form_cues, list):
            cues_text = ", ".join([c for c in (_norm(x) for x in form_cues) if c])
        if not name:
            continue
        text = f"{name}. Form cues: {cues_text}" if cues_text else name
        out.append(_make(text, tab_id, component, f"exercises[{i}]"))
    return out


def _h_quiz(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, q in enumerate(props.get("questions") or []):
        if not isinstance(q, dict):
            continue
        question = _norm(q.get("question"))
        options = q.get("options")
        correct_index = q.get("correctIndex")
        explanation = _norm(q.get("explanation"))
        correct_answer = ""
        if (
            isinstance(options, list)
            and isinstance(correct_index, int)
            and 0 <= correct_index < len(options)
        ):
            correct_answer = _norm(options[correct_index])
        if not question:
            continue
        parts = [f"Q: {question}"]
        if correct_answer:
            parts.append(f"A: {correct_answer}")
        if explanation:
            parts.append(f"— {explanation}")
        out.append(_make(_join_clean(parts), tab_id, component, f"questions[{i}]"))
    return out


def _h_flash_deck(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, card in enumerate(props.get("cards") or []):
        if not isinstance(card, dict):
            continue
        front = _norm(card.get("front"))
        back = _norm(card.get("back"))
        if not (front or back):
            continue
        text = f"{front} — {back}".strip(" —")
        out.append(_make(text, tab_id, component, f"cards[{i}]"))
    return out


def _h_scenario(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, sc in enumerate(props.get("scenarios") or []):
        if not isinstance(sc, dict):
            continue
        question = _norm(sc.get("question"))
        options = sc.get("options")
        correct_text = ""
        correct_explanation = ""
        if isinstance(options, list):
            for opt in options:
                if isinstance(opt, dict) and opt.get("correct"):
                    correct_text = _norm(opt.get("text"))
                    correct_explanation = _norm(opt.get("explanation"))
                    break
        if not question:
            continue
        parts = [question]
        if correct_text:
            parts.append(f"Correct: {correct_text}")
        if correct_explanation:
            parts.append(f"— {correct_explanation}")
        out.append(_make(_join_clean(parts), tab_id, component, f"scenarios[{i}]"))
    return out


def _h_verdict(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    bottom_line = _norm(props.get("bottomLine"))
    if bottom_line:
        out.append(_make(bottom_line, tab_id, component, "bottomLine"))
    for i, item in enumerate(props.get("bestFor") or []):
        text = _norm(item)
        if text:
            out.append(_make(text, tab_id, component, f"bestFor[{i}]"))
    for i, item in enumerate(props.get("notFor") or []):
        text = _norm(item)
        if text:
            out.append(_make(text, tab_id, component, f"notFor[{i}]"))
    return out


def _h_budget(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, tip in enumerate(props.get("savingTips") or []):
        text = _norm(tip)
        if text:
            out.append(_make(text, tab_id, component, f"savingTips[{i}]"))
    return out


def _h_gallery(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, img in enumerate(props.get("images") or []):
        if not isinstance(img, dict):
            continue
        caption = _norm(img.get("caption"))
        if caption:
            out.append(_make(caption, tab_id, component, f"images[{i}].caption"))
    return out


def _h_clip_player(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    """Legacy — superseded by ``moment_track``. Same retention rationale as
    ``_h_timeline``: defensive coverage for historical MongoDB records that
    were serialized before the unified component shipped.
    """
    out: list[OutputChunk] = []
    for i, clip in enumerate(props.get("clips") or []):
        if not isinstance(clip, dict):
            continue
        label = _norm(clip.get("label"))
        description = _norm(clip.get("description"))
        if not (label or description):
            continue
        text = f"{label}. {description}" if (label and description) else (label or description)
        out.append(_make(text, tab_id, component, f"clips[{i}]"))
    return out


def _h_lyrics_player(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    out: list[OutputChunk] = []
    for i, section in enumerate(props.get("sections") or []):
        if not isinstance(section, dict):
            continue
        analysis = _norm(section.get("analysis"))
        if analysis:
            out.append(_make(analysis, tab_id, component, f"sections[{i}].analysis"))
    return out


def _h_display_section(tab_id: str, component: str, props: dict) -> list[OutputChunk]:
    """Catch-all flattener — only whitelisted prose keys are extracted.

    The whitelist is intentional: blind flattening of ``data`` would pull in
    IDs, URLs, button labels, and enum flags, polluting the embedding index.
    """
    data = props.get("data")
    parts: list[str] = []
    _collect_whitelisted_strings(data, parts)
    text = _join_clean(parts)
    if not text:
        return []
    return [_make(text, tab_id, component, "data")]


def _collect_whitelisted_strings(node: Any, out: list[str]) -> None:
    """Recursively gather string values whose key is in the whitelist."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str) and k in _DISPLAY_SECTION_WHITELIST:
                cleaned = v.strip()
                if cleaned:
                    out.append(cleaned)
            elif isinstance(v, (dict, list)):
                _collect_whitelisted_strings(v, out)
    elif isinstance(node, list):
        for item in node:
            _collect_whitelisted_strings(item, out)


# ──────────────────────────────────────────────────────────────────────
# Registry — authoritative list of supported components.
# Adding a new render component requires adding a row here.
# ──────────────────────────────────────────────────────────────────────

_COMPONENT_HANDLERS: dict[str, Callable[[str, str, dict], list[OutputChunk]]] = {
    # ASSEMBLER_REGISTRY components — keep in sync with
    # ``services/summarizer/src/services/pipeline/assembly/assemblers.py``.
    "overview": _h_overview,
    "spot_explorer": _h_spot_explorer,
    "moment_track": _h_moment_track,
    "code_explorer": _h_code_explorer,
    "comparison": _h_comparison,
    "info_grid": _h_info_grid,
    "checklist": _h_checklist,
    "step_player": _h_step_player,
    "exercise_tracker": _h_exercise_tracker,
    "quiz": _h_quiz,
    "flash_deck": _h_flash_deck,
    "scenario": _h_scenario,
    "verdict": _h_verdict,
    "budget": _h_budget,
    "gallery": _h_gallery,
    "lyrics_player": _h_lyrics_player,
    "display_section": _h_display_section,
    # Legacy — superseded by ``moment_track``. Retained so historical
    # MongoDB records keep producing chunks on reprocess. Remove once
    # ``db.videoSummary.distinct("tabs.component")`` no longer returns them.
    "timeline": _h_timeline,
    "clip_player": _h_clip_player,
}
