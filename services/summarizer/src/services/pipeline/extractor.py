"""Adaptive structured extraction — 1-3 LLM calls based on transcript length."""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, AsyncGenerator

from pydantic import ValidationError

from ...models.output_types import validate_output, output_type_to_prompt_name
from ...utils.accuracy_rules import get_accuracy_rules
from ...utils.json_parsing import parse_json_response

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

# Token-based thresholds for adaptive strategy (1 token ≈ 0.75 words)
SINGLE_THRESHOLD = 5333       # ~4K tokens → 1 call
OVERFLOW_THRESHOLD = 20000    # ~15K tokens → 1+overflow retry
# >20K words AND >3h duration = segmented

# Duration gate: only segment videos longer than 3 hours
SEGMENTATION_DURATION_MINUTES = 180


def _estimate_tokens(text: str) -> int:
    """Estimate token count from text. ~1.33 words per token for English."""
    return int(len(text.split()) * 1.33)


@lru_cache(maxsize=16)
def _load_prompt(path_str: str) -> str:
    """Load and cache a prompt template from disk."""
    return Path(path_str).read_text()


async def extract(
    llm_service: LLMService,
    output_type: str,
    transcript: str,
    video_data: dict,
    intent,
) -> AsyncGenerator[dict, None]:
    """Adaptive extraction yielding progress events and final result.

    Strategy selection based on word count and duration:
    - <5.3K words (~4K tokens): single extraction call
    - 5.3-20K words (~4-15K tokens): single call + overflow retry if validation fails
    - 20K+ words AND >3h duration: segmented extraction (2-3 segments, merged)
    - 20K+ words but <3h: overflow (context window handles it)
    """
    word_count = len(transcript.split())
    duration_minutes = video_data.get("duration", 0) / 60
    logger.info("Extraction: type=%s, words=%d, duration=%.0fmin", output_type, word_count, duration_minutes)

    prompt_file = PROMPTS_DIR / f"extract_{output_type_to_prompt_name(output_type)}.txt"
    if not prompt_file.exists():
        prompt_file = PROMPTS_DIR / "extract_smart.txt"
        logger.warning("No prompt for %s, falling back to extract_smart.txt", output_type)

    prompt_template = _load_prompt(str(prompt_file))
    rules_path = PROMPTS_DIR / "accuracy_rules.txt"
    generic_rules = _load_prompt(str(rules_path)) if rules_path.exists() else ""
    type_specific_rules = get_accuracy_rules(output_type)
    accuracy_rules = generic_rules
    if type_specific_rules:
        accuracy_rules += f"\n\nDOMAIN-SPECIFIC RULES ({output_type}):\n{type_specific_rules}"

    sections_desc = "\n".join(
        f"- {s.id}: {s.label} — {s.description}" for s in intent.sections
    )

    # Strategy selection: segmented only for very long videos (>3h AND >20K words)
    use_segmented = (
        word_count >= OVERFLOW_THRESHOLD
        and duration_minutes > SEGMENTATION_DURATION_MINUTES
    )

    if word_count < SINGLE_THRESHOLD:
        async for event in _single_extraction(
            llm_service, output_type, prompt_template, accuracy_rules,
            transcript, video_data, sections_desc,
        ):
            yield event
    elif not use_segmented:
        async for event in _overflow_extraction(
            llm_service, output_type, prompt_template, accuracy_rules,
            transcript, video_data, sections_desc,
        ):
            yield event
    else:
        chapters = video_data.get("chapters", [])
        async for event in _segmented_extraction(
            llm_service, output_type, prompt_template, accuracy_rules,
            transcript, video_data, sections_desc, word_count, chapters,
        ):
            yield event


def _format_prompt(template: str, video_data: dict, transcript: str, rules: str, sections_desc: str) -> str:
    """Format an extraction prompt with common fields.

    Uses .replace() instead of .format() to avoid format-string injection
    from user-controlled content (titles, transcripts).
    """
    return (
        template
        .replace("{title}", video_data.get("title", ""))
        .replace("{transcript}", transcript)
        .replace("{accuracy_rules}", rules)
        .replace("{sections}", sections_desc)
        .replace("{duration_minutes}", str(round(video_data.get("duration", 0) / 60)))
    )


def _parse_llm_json(raw: str) -> dict:
    """Parse JSON from LLM response using robust parser."""
    data = parse_json_response(raw)
    if not data:
        logger.error("Failed to parse JSON from LLM response (len=%d): %.500s", len(raw), repr(raw[:500]))
        raise ValueError("Failed to parse JSON from LLM response")
    return data


async def _single_extraction(llm_service: LLMService, output_type: str, template: str, rules: str, transcript: str, video_data: dict, sections_desc: str):
    """Single extraction call for short transcripts (<4K words)."""
    yield {"event": "extraction_progress", "section": "all", "percent": 10}

    prompt = _format_prompt(template, video_data, transcript, rules, sections_desc)

    yield {"event": "extraction_progress", "section": "all", "percent": 30}
    raw = await llm_service.call_llm(prompt, max_tokens=16384)
    data = _parse_llm_json(raw)

    yield {"event": "extraction_progress", "section": "all", "percent": 80}
    validated = validate_output(output_type, data)

    yield {"event": "extraction_progress", "section": "all", "percent": 100}
    yield {
        "event": "extraction_complete",
        "outputType": output_type,
        "data": validated.model_dump(by_alias=True),
    }


async def _overflow_extraction(llm_service: LLMService, output_type: str, template: str, rules: str, transcript: str, video_data: dict, sections_desc: str):
    """Overflow extraction for medium transcripts (4-15K words).

    Makes one primary call with higher token limit.
    If validation fails, retries with error context and merges.
    """
    yield {"event": "extraction_progress", "section": "primary", "percent": 10}

    prompt = _format_prompt(template, video_data, transcript, rules, sections_desc)

    yield {"event": "extraction_progress", "section": "primary", "percent": 25}
    raw = await llm_service.call_llm(prompt, max_tokens=16384)
    data = _parse_llm_json(raw)

    yield {"event": "extraction_progress", "section": "primary", "percent": 70}

    try:
        validated = validate_output(output_type, data)
        yield {"event": "extraction_progress", "section": "all", "percent": 100}
        yield {
            "event": "extraction_complete",
            "outputType": output_type,
            "data": validated.model_dump(by_alias=True),
        }
    except (ValidationError, ValueError) as e:
        logger.warning("Overflow extraction validation failed: %s — retrying with error context", e)
        yield {"event": "extraction_progress", "section": "retry", "percent": 75}

        error_summary = str(e)[:500]
        partial_output = _truncate_json(data, 2000)
        retry_prompt = (
            f"The previous extraction had validation errors:\n"
            f"<error>\n{error_summary}\n</error>\n\n"
            f"Please fix the output and return valid JSON matching the schema.\n\n"
            f"Previous (partial) output:\n<partial_output>\n{partial_output}\n</partial_output>\n\n"
            f"Original transcript (first 3000 chars):\n<transcript>\n{transcript[:3000]}\n</transcript>"
        )
        raw2 = await llm_service.call_llm(retry_prompt, max_tokens=16384)
        data2 = _parse_llm_json(raw2)

        # Merge retry data into original (concatenate lists, keep latest scalars)
        merged = dict(data)
        for key, value in data2.items():
            if key in merged and isinstance(value, list) and isinstance(merged[key], list):
                merged[key].extend(value)
            else:
                merged[key] = value

        try:
            validated = validate_output(output_type, merged)
        except (ValidationError, ValueError) as retry_err:
            logger.error("Overflow retry validation also failed: %s — using raw merged data", retry_err)
            raise

        yield {"event": "extraction_progress", "section": "all", "percent": 100}
        yield {
            "event": "extraction_complete",
            "outputType": output_type,
            "data": validated.model_dump(by_alias=True),
        }


async def _segmented_extraction(llm_service: LLMService, output_type: str, template: str, rules: str, transcript: str, video_data: dict, sections_desc: str, word_count: int, chapters: list | None = None):
    """Segmented extraction for very long transcripts (>3h AND >20K words).

    Splits transcript using chapter boundaries when available, otherwise
    uses token-based splitting. Extracts each segment, then merges.
    Lists are concatenated; scalars take the latest value.
    """
    if chapters and len(chapters) >= 2:
        segments = _split_by_chapters(transcript, chapters)
        logger.info("Segmented extraction: %d chapter-based segments for %d words", len(segments), word_count)
    else:
        token_count = _estimate_tokens(transcript)
        segment_count = min(3, max(2, token_count // 13000))  # ~13K tokens per segment
        words = transcript.split()
        segment_size = len(words) // segment_count

        segments = []
        for i in range(segment_count):
            start = i * segment_size
            end = start + segment_size if i < segment_count - 1 else len(words)
            segments.append(" ".join(words[start:end]))

        logger.info("Segmented extraction: %d token-based segments for %d words (~%d tokens)", len(segments), word_count, token_count)

    total_segments = len(segments)
    all_data: dict = {}
    for idx, segment in enumerate(segments):
        pct_start = int((idx / total_segments) * 80)
        pct_end = int(((idx + 1) / total_segments) * 80)
        yield {"event": "extraction_progress", "section": f"segment_{idx + 1}", "percent": pct_start}

        prompt = _format_prompt(template, video_data, segment, rules, sections_desc)
        raw = await llm_service.call_llm(prompt, max_tokens=16384)
        segment_data = _parse_llm_json(raw)

        # Merge: concatenate lists, keep latest scalars
        for key, value in segment_data.items():
            if key in all_data and isinstance(value, list) and isinstance(all_data[key], list):
                all_data[key].extend(value)
            else:
                all_data[key] = value

        yield {"event": "extraction_progress", "section": f"segment_{idx + 1}", "percent": pct_end}

    yield {"event": "extraction_progress", "section": "validation", "percent": 85}
    validated = validate_output(output_type, all_data)

    yield {"event": "extraction_progress", "section": "all", "percent": 100}
    yield {
        "event": "extraction_complete",
        "outputType": output_type,
        "data": validated.model_dump(by_alias=True),
    }


def _split_by_chapters(transcript: str, chapters: list) -> list[str]:
    """Split transcript into segments aligned to chapter boundaries.

    Groups chapters into 2-3 segments, keeping total token count
    roughly balanced across segments.
    """
    if len(chapters) <= 3:
        # Few chapters — each chapter is its own segment
        # Simple split by rough position in transcript
        words = transcript.split()
        total = len(words)
        segment_size = total // len(chapters)
        segments = []
        for i in range(len(chapters)):
            start = i * segment_size
            end = start + segment_size if i < len(chapters) - 1 else total
            segments.append(" ".join(words[start:end]))
        return segments

    # Many chapters — group into 2-3 balanced segments
    words = transcript.split()
    total = len(words)
    target_segments = min(3, max(2, _estimate_tokens(transcript) // 13000))
    target_size = total // target_segments

    segments = []
    current_start = 0

    for seg_idx in range(target_segments):
        if seg_idx == target_segments - 1:
            # Last segment gets remaining words
            segments.append(" ".join(words[current_start:]))
        else:
            end = min(current_start + target_size, total)
            # Try to align to a sentence boundary near the target
            # Look for period + space within ±200 words of target
            search_start = max(current_start, end - 200)
            search_end = min(total, end + 200)
            search_text = " ".join(words[search_start:search_end])
            period_pos = search_text.rfind(". ")
            if period_pos > 0:
                # Count words up to the period
                words_to_period = len(search_text[:period_pos + 1].split())
                end = search_start + words_to_period

            segments.append(" ".join(words[current_start:end]))
            current_start = end

    return [s for s in segments if s.strip()]


def _truncate_json(data: dict, max_chars: int) -> str:
    """Serialize and truncate JSON for retry prompts."""
    serialized = json.dumps(data, indent=2)
    if len(serialized) > max_chars:
        return serialized[:max_chars] + "\n... (truncated)"
    return serialized
