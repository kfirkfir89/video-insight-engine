"""Translation step — translates assembled output to English for non-English videos.

Gated on ctx.language != "en". Uses Haiku (fast model) for cost efficiency.
Produces tabs_en, meta_en, synthesis_en stored alongside original-language content.
Also reverse-translates English UI labels and cross-tab link labels to the video's language.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from ...config import settings
from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from ...utils.language_utils import get_language_name
from .prompt_builder import load_prompt_text

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)
PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "translate.txt"

# Max chars per single Haiku call — batch if larger
_MAX_CHARS_PER_CALL = 100_000

# Keys that hold English UI labels injected by assemblers
_LABEL_KEYS = frozenset({
    "nextLabel", "previousLabel", "doneLabel", "undoLabel",
    "correctLabel", "tryAgainLabel", "reviewLabel", "missedLabel",
    "gotItLabel", "reviewAgainLabel", "cardsReviewedLabel",
    "showAllLabel", "stepThroughLabel", "copyLabel", "copiedLabel",
    "formCueLabel", "hideFormCueLabel", "durationLabel", "equipmentLabel",
    "completeSetLabel", "celebrationTitle", "celebrationSubtitle",
    "ingredientsLabel", "leftColumnLabel", "rightColumnLabel", "goForItLabel",
    "priceLabel", "scoreLabel", "levelLabel", "itemsLabel",
    "tabLabel",
})


def _load_translate_prompt() -> str:
    """Registry-first translate prompt. Records version on the active trace."""
    return load_prompt_text(PROMPT_PATH)


def _collect_english_labels(tabs: list[dict[str, Any]]) -> dict[str, str]:
    """Collect unique English UI label values from all tab props and cross-tab links."""
    labels: dict[str, str] = {}
    for tab in tabs:
        props = tab.get("props", {})
        for key, val in props.items():
            if key in _LABEL_KEYS and isinstance(val, str) and val:
                labels[key] = val
        for link in tab.get("crossTabLinks", []):
            lbl = link.get("label", "")
            if lbl:
                labels[f"link:{lbl}"] = lbl
    return labels


def _apply_translated_labels(
    tabs: list[dict[str, Any]],
    translations: dict[str, str],
) -> None:
    """Mutate original tabs in-place: replace English labels with translated versions."""
    link_map: dict[str, str] = {}
    for key, val in translations.items():
        if key.startswith("link:") and val:
            original = key[5:]  # strip "link:" prefix
            link_map[original] = val

    for tab in tabs:
        props = tab.get("props", {})
        for key in _LABEL_KEYS:
            if key in props and key in translations:
                props[key] = translations[key]
        for link in tab.get("crossTabLinks", []):
            original_label = link.get("label", "")
            if original_label in link_map:
                link["label"] = link_map[original_label]


async def _translate_json(
    llm_service: LLMService,
    content: Any,
    source_language: str,
    target_language: str = "English",
    stage_name: str = "translation",
) -> Any:
    """Translate a JSON-serializable object between languages.

    Args:
        llm_service: LLM service instance.
        content: JSON-serializable content (dict, list, etc.).
        source_language: ISO 639-1 code of the source language.
        target_language: Name of the target language (e.g. "English", "Hebrew").
        stage_name: Name for logging/retry tracking.

    Returns:
        Translated content with same structure, or original on failure.
    """
    content_json = json.dumps(content, ensure_ascii=False, separators=(",", ":"))

    # Skip if content is too small (likely already English or empty)
    if len(content_json) < 10:
        return content

    prompt_template = _load_translate_prompt()
    language_name = get_language_name(source_language)

    prompt = (
        prompt_template
        .replace("{source_language}", language_name)
        .replace("{target_language}", target_language)
        .replace("{content_json}", content_json[:_MAX_CHARS_PER_CALL])
    )

    try:
        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=16384, timeout=60.0, max_retries=2,
            stage_name=stage_name, json_mode=True, use_fast_model=True,
            model_override=settings.get_stage_model(stage_name),
        )
        if not raw:
            logger.warning("Translation LLM call failed after retries")
            return content

        translated = parse_json_response(raw)
        if not translated:
            logger.warning("Failed to parse translation response")
            return content

        return translated

    except Exception as e:
        logger.error("Translation failed: %s — returning original", e)
        return content


async def translate_assembled_output(
    llm_service: LLMService,
    tabs: list[dict[str, Any]],
    meta: dict[str, Any],
    synthesis: dict[str, Any],
    source_language: str,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    """Translate assembled output with three focused calls.

    For non-English videos:
    1. Translates tabs from source_language → English (tabs_en)
    2. Translates meta+synthesis from source_language → English
    3. Translates English UI labels → source_language (mutates original tabs in-place)

    Args:
        llm_service: LLM service instance.
        tabs: Assembled tab list (mutated in-place with translated labels).
        meta: Assembled meta dict.
        synthesis: Synthesis result dict.
        source_language: ISO 639-1 code of the source language.

    Returns:
        Tuple of (tabs_en, meta_en, synthesis_en).
    """
    language_name = get_language_name(source_language)
    logger.info("Translating assembled output from %s to English", language_name)

    # Translate tabs and meta+synthesis in parallel (independent calls)
    meta_synthesis = {"meta": meta, "synthesis": synthesis}
    tabs_en, meta_synthesis_en = await asyncio.gather(
        _translate_json(llm_service, tabs, source_language, stage_name="translation_tabs"),
        _translate_json(llm_service, meta_synthesis, source_language, stage_name="translation_meta"),
    )

    meta_en = meta_synthesis_en.get("meta", meta) if isinstance(meta_synthesis_en, dict) else meta
    synthesis_en = meta_synthesis_en.get("synthesis", synthesis) if isinstance(meta_synthesis_en, dict) else synthesis

    # Ensure tabs_en is a list
    if not isinstance(tabs_en, list):
        logger.warning("Translation returned non-list for tabs, using original")
        tabs_en = tabs

    # Call 3: Reverse-translate English UI labels → video language
    # This is a tiny call (~20 key-value pairs, ~200 tokens)
    english_labels = _collect_english_labels(tabs)
    if english_labels:
        label_translations = await _translate_json(
            llm_service, english_labels,
            source_language="en",
            target_language=language_name,
            stage_name="translation_labels",
        )
        if isinstance(label_translations, dict) and label_translations:
            _apply_translated_labels(tabs, label_translations)
            logger.info(
                "Applied %d translated UI labels to original tabs",
                len(label_translations),
            )

    logger.info(
        "Translation complete: %d tabs, meta keys=%d, synthesis keys=%d",
        len(tabs_en), len(meta_en), len(synthesis_en),
    )

    return tabs_en, meta_en, synthesis_en
