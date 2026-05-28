"""Translation step — translates assembled output to English for non-English videos.

Single LLM call. Walks the output tree recursively, collects every translatable
prose string into a flat list (filtered by a leaf-only deny-list of structural,
asset, and enum-shaped keys), sends one Haiku call, applies the translations
back into a deep-copy of the original.

On success: returns an English-primary dict with the original-language artifact
nested under ``sourceLanguage`` ({code, name, isRTL, tabs, meta}).
On any failure (LLM error, length mismatch, mirror detection): returns the
input unchanged so the FE simply renders no toggle.

Mirror detection samples the 3 longest collected strings — small models
occasionally echo source-language strings back, and longest-string sampling
avoids false-positives on short tokens that legitimately match across
languages (proper nouns, ASCII identifiers).
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from ...config import settings
from ...utils.json_parsing import parse_json_response
from ...utils.language_utils import (
    get_language_name,
    get_native_name,
    is_rtl,
)
from ...utils.llm_retry import call_llm_with_retry
from .prompt_builder import load_prompt_text

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

FLAT_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "translate_flat.txt"

# Keys whose PRIMITIVE STRING values must NOT be translated.
#
# LEAF-ONLY semantics: the deny rule only applies when the value at the key
# is a primitive string. Lists and dicts are always recursed, so container
# keys with deny-listed names (e.g. a hypothetical ``warmup: [{...}]``) still
# descend into their contents. The rule only blocks translation when the
# named key directly identifies a leaf string.
_SKIP_KEYS: frozenset[str] = frozenset({
    # Structural identifiers / routing
    "id", "component", "language", "targetTab", "type", "layout", "platform",
    # Asset references — URLs, S3 keys, raw code
    "url", "thumbnailUrl", "s3Key", "code",
    # Numeric routing keys — pure offsets/indices, never prose
    "timestamp", "time", "seconds", "startSeconds", "endSeconds",
    # Enums / non-prose primitives kept stable across languages
    "emoji", "correctIndex", "difficulty", "mood",
    # ``sets`` is always a number in the fitness schema. ``reps``/``rest``/
    # ``duration`` are deliberately ABSENT — the fitness schema emits prose
    # at these keys (e.g. ``"30 שניות"``, ``"AMRAP"``, ``"until failure"``),
    # so they must flow through translation or English exercise cards
    # render mixed-language strings.
    "sets",
    # Vision-LLM output kept verbatim — vision is prompted in English so its
    # caption/evidence strings are already English regardless of source
    # language. ``frameOcr`` is deliberately ABSENT: Tesseract output is the
    # original on-screen language (e.g. Hebrew screen text in a Hebrew video),
    # so it must flow through the translator like any other prose. ``sceneType``
    # is an enum-shape token ("talking_head", "screen_capture", …).
    "frameCaption", "frameSceneType", "frameEvidence",
})

# Min collected-string length (after strip). Skips numerics, single tokens,
# 1-3 char strings that are usually labels in another vocabulary (status,
# enum-ish remnants, etc.).
_MIN_TRANSLATABLE_LEN = 3

# Hard caps so a pathological payload (deeply nested or accidentally-large
# blob in props) can't blow the recursion stack or balloon the LLM call into
# a many-MB output. 800 strings at ~20 chars/string ≈ Haiku's 16K-token cap;
# 32 levels is well beyond any real assembled-tab shape (~6 levels typical).
_MAX_COLLECTED_STRINGS = 800
_MAX_RECURSION_DEPTH = 32

# JSON path — alternating dict keys (str) and list indices (int).
JsonPath = tuple[str | int, ...]


# ─── Walker ──────────────────────────────────────────────────────────────────


def _collect_strings(
    obj: Any,
    path: JsonPath,
    pairs: list[tuple[JsonPath, str]],
    depth: int = 0,
) -> None:
    """Recursively append ``(path, value)`` for every translatable string.

    Container nodes (list/dict) are ALWAYS recursed. The deny-list applies
    ONLY when the value at a key is a primitive string — see ``_SKIP_KEYS``.
    Bounded by ``_MAX_RECURSION_DEPTH`` and ``_MAX_COLLECTED_STRINGS`` so a
    runaway payload can't waste a 90s LLM call or stack-overflow. Truncation
    is observed by ``translate_to_source`` after the walk completes, since
    logging inside the recursion would either fire many times per cap-hit or
    require a mutable flag plumbed through every frame.
    """
    if depth > _MAX_RECURSION_DEPTH or len(pairs) >= _MAX_COLLECTED_STRINGS:
        return
    if isinstance(obj, str):
        if len(obj.strip()) > _MIN_TRANSLATABLE_LEN:
            pairs.append((path, obj))
        return
    if isinstance(obj, list):
        for i, item in enumerate(obj):
            _collect_strings(item, path + (i,), pairs, depth + 1)
        return
    if isinstance(obj, dict):
        for key, value in obj.items():
            # Leaf-only: skip only when the deny-listed key holds a string.
            if key in _SKIP_KEYS and isinstance(value, str):
                continue
            _collect_strings(value, path + (key,), pairs, depth + 1)


def _set_at_path(root: Any, path: JsonPath, value: str) -> None:
    """Walk to ``path``'s parent in ``root`` and set the leaf to ``value``.

    Silent no-op on broken paths so an off-by-one in the translation list
    cannot corrupt unrelated subtrees.
    """
    if not path:
        return
    target = root
    try:
        for segment in path[:-1]:
            target = target[segment]
        target[path[-1]] = value
    except (KeyError, IndexError, TypeError):
        return


# ─── LLM call ────────────────────────────────────────────────────────────────


async def _translate_flat_list(
    llm_service: LLMService,
    strings: list[str],
    source_language: str,
    stage_name: str = "translation_full",
) -> list[str] | None:
    """Translate a flat list of strings via one Haiku call.

    Returns None on any failure (LLM error, JSON parse, non-string items,
    length mismatch). Caller decides how to recover.
    """
    if not strings:
        return []

    prompt_template = load_prompt_text(FLAT_PROMPT_PATH)
    src_name = get_language_name(source_language)
    prompt = (
        prompt_template
        .replace("{source_language}", src_name)
        .replace("{target_language}", "English")
        .replace("{strings_json}", json.dumps(strings, ensure_ascii=False))
    )

    try:
        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=16384, timeout=90.0, max_retries=2,
            stage_name=stage_name, json_mode=True, use_fast_model=True,
            model_override=settings.get_stage_model(stage_name),
        )
        if not raw:
            return None

        parsed = parse_json_response(raw)
        # JSON-mode small models often wrap the array in a single-key object;
        # unwrap any known key name, or fall back to the only list value.
        if isinstance(parsed, dict):
            unwrapped: Any = None
            for key in ("translations", "items", "strings",
                        "translated", "output", "result", "data"):
                if isinstance(parsed.get(key), list):
                    unwrapped = parsed[key]
                    break
            if unwrapped is None:
                list_values = [v for v in parsed.values() if isinstance(v, list)]
                if len(list_values) == 1:
                    unwrapped = list_values[0]
            if unwrapped is not None:
                parsed = unwrapped

        if not isinstance(parsed, list):
            logger.warning(
                "Translation returned non-list (type=%s)", type(parsed).__name__,
            )
            return None
        if not all(isinstance(s, str) for s in parsed):
            logger.warning("Translation contained non-string items")
            return None
        if len(parsed) != len(strings):
            logger.warning(
                "Translation length mismatch: expected %d, got %d",
                len(strings), len(parsed),
            )
            return None
        return parsed
    except (json.JSONDecodeError, ValueError, TypeError,
            asyncio.TimeoutError, OSError) as e:
        # Narrow boundary catch: JSON parse / shape / I/O / timeout errors
        # are the realistic failure modes for an LLM-mode JSON call. Other
        # exceptions (KeyError, AttributeError) are programming bugs and
        # should surface in tests rather than be silently downgraded to a
        # translation no-op.
        logger.error("Translation failed: %s", e)
        return None


# ─── Orchestrator ────────────────────────────────────────────────────────────


# Fraction of overall strings that must mirror before we declare the LLM
# ignored the prompt. Set high enough that a legitimate translation keeping a
# few brand names / embedded English phrases verbatim doesn't trip the gate.
_MIRROR_OVERALL_THRESHOLD = 0.5

# Below this many collected strings the "3 longest" sample is too small to be
# reliable — fall back to a stricter overall-mirror check so small payloads
# still get gated. 10 was chosen because it's roughly the floor at which a
# real video carries enough prose (≥3 tabs × ~3 strings/tab) for the longest-
# sample heuristic to discriminate; below that, a model echoing 4 of 6 short
# strings would pass the longest-3 gate by coincidence.
_MIRROR_SMALL_PAYLOAD_FLOOR = 10
# Stricter threshold for small payloads: more than 1/3 mirrored is suspicious
# when only a handful of strings exist (proper nouns dominate small samples).
_MIRROR_SMALL_PAYLOAD_THRESHOLD = 0.33


def _is_mirror(originals: list[str], translations: list[str]) -> bool:
    """True when the LLM appears to have echoed source-language strings back.

    Two-signal gate to avoid false-positives on legitimate translations that
    keep a few strings verbatim (brand names, code identifiers, quoted English
    phrases embedded in a non-English video):

      1. ALL of the 3 LONGEST strings are byte-identical between input and
         output. Long strings legitimately translating to the exact same
         bytes is near-impossible in practice — short tokens (proper nouns,
         ASCII) can collide but not full prose.
      2. AND > 50% of ALL strings are byte-identical. A real translation
         keeps maybe 5-15% verbatim (names, brands); >50% means the model
         echoed the input.

    Both conditions must hold. This protects against the audited "small model
    ignores the prompt and echoes input" failure mode while preserving good
    translations that happen to retain a few long brand strings verbatim.

    Small payloads (<10 strings) fall back to a single stricter overall-ratio
    check — the "3 longest" sample is unreliable when proper nouns and short
    ASCII tokens dominate a tiny sample.
    """
    if not originals or len(originals) != len(translations):
        return False
    overall_mirror_count = sum(
        1 for o, t in zip(originals, translations) if o == t
    )
    overall_ratio = overall_mirror_count / len(originals)

    if len(originals) < _MIRROR_SMALL_PAYLOAD_FLOOR:
        # Small payloads: a single threshold; >33% verbatim is the signal.
        return overall_ratio > _MIRROR_SMALL_PAYLOAD_THRESHOLD

    indices = sorted(range(len(originals)), key=lambda i: -len(originals[i]))[:3]
    longest_all_mirror = all(originals[i] == translations[i] for i in indices)
    if not longest_all_mirror:
        return False
    return overall_ratio > _MIRROR_OVERALL_THRESHOLD


async def translate_to_source(
    llm_service: LLMService,
    output: dict[str, Any],
    source_lang: str,
) -> dict[str, Any]:
    """Translate ``output`` from ``source_lang`` to English-primary shape.

    Args:
        llm_service: LLM service for the Haiku call.
        output: Source-language dict, shape ``{"tabs": [...], "meta": {...}, "synthesis": {...}}``.
        source_lang: ISO 639-1 code of the input language (e.g. ``"he"``).

    Returns:
        On success: a NEW dict with English values at top level + the
        original-language artifact nested under ``sourceLanguage`` (with
        ``code``, native ``name``, ``isRTL``, and the three payloads).
        On any failure: the ``output`` arg unchanged (no ``sourceLanguage``
        key). Callers detect success via ``"sourceLanguage" in result``.
    """
    pairs: list[tuple[JsonPath, str]] = []
    _collect_strings(output, (), pairs)
    if not pairs:
        # Pathological but possible: video with no translatable prose (very
        # short clips, all-emoji titles, or aggressive deny-listing of every
        # populated key). Logging makes this visible in observability rather
        # than silently leaving the FE with no language toggle and Mongo
        # still labelled as the non-English source language.
        logger.info(
            "Translation no-op: no translatable prose collected (source=%s). "
            "Output unchanged; FE will render no language toggle.",
            source_lang,
        )
        return output

    # Fail-closed on cap-hit. The walker silently stops at _MAX_COLLECTED_STRINGS,
    # so anything beyond the cap would ship as untranslated source-language
    # prose mixed into the English-primary surface — a half-translated payload
    # that's worse than no translation (the FE expects all-or-nothing). Return
    # input unchanged so the FE renders no language toggle, which is the safe
    # default for an oversized tree. The boundary case (exactly the cap) is a
    # false positive, but the rarity of hitting it precisely and the much
    # higher cost of a leaked source-language tail justify the conservative
    # bail-out. If real videos legitimately approach the cap, raise the
    # constant rather than papering over with a partial result.
    if len(pairs) >= _MAX_COLLECTED_STRINGS:
        logger.warning(
            "Translation walker reached %d-string cap; aborting translation "
            "to avoid shipping a half-translated payload. Source language: %s. "
            "If this fires on real videos, raise _MAX_COLLECTED_STRINGS.",
            _MAX_COLLECTED_STRINGS, source_lang,
        )
        return output

    originals = [s for _, s in pairs]
    logger.info(
        "Translating %d strings (%d chars) from %s to English",
        len(originals), sum(len(s) for s in originals), source_lang,
    )

    translations = await _translate_flat_list(llm_service, originals, source_lang)
    if translations is None:
        logger.warning(
            "Translation failed — returning input unchanged (no sourceLanguage)",
        )
        return output

    if _is_mirror(originals, translations):
        logger.warning(
            "Translation appears to mirror source language — discarding",
        )
        return output

    english = copy.deepcopy(output)
    for (path, _), translated in zip(pairs, translations):
        _set_at_path(english, path, translated)

    # Force top-level meta to reflect English-primary semantics.
    if isinstance(english.get("meta"), dict):
        english["meta"]["language"] = "en"
        english["meta"]["isRTL"] = False

    # Deep-copy the source-language artifact so a downstream mutation of
    # ``ctx.assembled_tabs`` (which still references the input ``output``)
    # cannot corrupt the persisted ``sourceLanguage`` block. Cheap relative
    # to the LLM call we just made.
    english["sourceLanguage"] = {
        "code": source_lang,
        "name": get_native_name(source_lang),
        "isRTL": is_rtl(source_lang),
        "tabs": copy.deepcopy(output.get("tabs", [])),
        "meta": copy.deepcopy(output.get("meta", {})),
    }
    return english
