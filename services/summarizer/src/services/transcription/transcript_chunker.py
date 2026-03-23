"""Chapter-aware transcript splitting with fallback chain.

Splits long video transcripts into chapter-based chunks for batched extraction.
Fallback chain: YouTube chapters -> AI detection -> time-based split -> single chunk.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from ...utils.json_parsing import parse_json_response
from ...utils.llm_retry import call_llm_with_retry
from ...utils.transcript_slicer import slice_transcript_for_chapter
from ...services.pipeline.pipeline_helpers import normalize_segments

if TYPE_CHECKING:
    from ...services.llm import LLMService

logger = logging.getLogger(__name__)

_CHAPTER_DETECT_PROMPT: str | None = None


@dataclass
class ChapterChunk:
    """A chapter-sized transcript chunk for batched extraction."""

    index: int
    title: str
    start_seconds: float
    end_seconds: float
    text: str
    source: str  # "youtube" | "ai_detected" | "time_split" | "full"
    token_estimate: int  # approximate token count


def _estimate_tokens(text: str) -> int:
    """Estimate token count from text (~1.33 words per token for English)."""
    return max(1, int(len(text.split()) * 1.33))


# Pre-compiled regex for sentence splitting in force_split_by_sentences
_ABBREV_PLACEHOLDER = "\uffff"  # Unicode noncharacter — safe for JSON/DB unlike NUL
_ABBREV_RE = re.compile(r'\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|approx|inc|avg)\.')
_SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+')

FORCE_SPLIT_TARGET_WORDS = 5000  # target words per chunk


def force_split_by_sentences(
    transcript: str,
    duration_seconds: float,
    target_words: int = FORCE_SPLIT_TARGET_WORDS,
) -> list[ChapterChunk]:
    """Force-split transcript at sentence boundaries when chapter splitting fails.

    Creates synthetic ChapterChunk objects by splitting the transcript
    into roughly equal word-count segments, snapping to sentence endings
    to avoid breaking mid-sentence.
    """
    # Protect common abbreviations from being treated as sentence endings
    protected = _ABBREV_RE.sub(lambda m: m.group(1) + _ABBREV_PLACEHOLDER, transcript)
    sentences = _SENTENCE_SPLIT_RE.split(protected)
    sentences = [s.replace(_ABBREV_PLACEHOLDER, ".") for s in sentences]
    if not sentences:
        return []

    total_words = sum(len(s.split()) for s in sentences)
    if total_words <= target_words:
        return []  # no split needed

    num_chunks = max(2, (total_words + target_words - 1) // target_words)
    chunk_duration = duration_seconds / num_chunks if duration_seconds > 0 else 0

    chunks: list[ChapterChunk] = []
    current_sentences: list[str] = []
    current_word_count = 0
    chunk_idx = 0

    for sentence in sentences:
        sentence_words = len(sentence.split())
        current_sentences.append(sentence)
        current_word_count += sentence_words

        if current_word_count >= target_words:
            text = " ".join(current_sentences)
            chunks.append(ChapterChunk(
                index=chunk_idx,
                title=f"Part {chunk_idx + 1}",
                start_seconds=chunk_idx * chunk_duration,
                end_seconds=min((chunk_idx + 1) * chunk_duration, duration_seconds),
                text=text,
                source="force_split",
                token_estimate=int(current_word_count * 1.33),
            ))
            chunk_idx += 1
            current_sentences = []
            current_word_count = 0

    # Append remaining sentences as the last chunk
    if current_sentences:
        text = " ".join(current_sentences)
        if chunks:
            if current_word_count < target_words // 3:
                # Merge small remainder into previous chunk
                prev = chunks[-1]
                chunks[-1] = ChapterChunk(
                    index=prev.index,
                    title=prev.title,
                    start_seconds=prev.start_seconds,
                    end_seconds=min((chunk_idx + 1) * chunk_duration, duration_seconds),
                    text=prev.text + " " + text,
                    source="force_split",
                    token_estimate=prev.token_estimate + int(current_word_count * 1.33),
                )
            else:
                chunks.append(ChapterChunk(
                    index=chunk_idx,
                    title=f"Part {chunk_idx + 1}",
                    start_seconds=chunk_idx * chunk_duration,
                    end_seconds=duration_seconds,
                    text=text,
                    source="force_split",
                    token_estimate=int(current_word_count * 1.33),
                ))
        else:
            return []

    return chunks if len(chunks) >= 2 else []


async def split_transcript_into_chapters(
    video_data: dict[str, Any],
    segments: list[dict[str, Any]],
    transcript: str,
    llm_service: LLMService | None = None,
) -> list[ChapterChunk]:
    """Split transcript into chapter-based chunks using fallback chain.

    Fallback chain:
    1. YouTube creator chapters (video_data["chapters"])
    2. AI chapter detection (fast model)
    3. Time-based splitting (~5 min segments)
    4. Single chunk (entire transcript)

    Args:
        video_data: Video metadata dict with optional "chapters", "duration", "title".
        segments: Transcript segments with startMs/endMs/text.
        transcript: Full transcript text (fallback when segments unavailable).
        llm_service: LLM service for AI chapter detection (optional).

    Returns:
        List of ChapterChunk, always at least 1.
    """
    duration = video_data.get("duration", 0)
    chapters = video_data.get("chapters")

    # Defensive: normalize segments to startMs/endMs format
    if segments:
        sample_keys = set(segments[0].keys()) if segments else set()
        if "start" in sample_keys and "startMs" not in sample_keys:
            logger.info("Normalizing %d segments from start/duration to startMs/endMs", len(segments))
            segments = normalize_segments(segments)

    # Path 1: YouTube chapters
    if chapters and len(chapters) >= 2:
        result = _from_youtube_chapters(chapters, segments, duration)
        if result:
            logger.info("Chapter splitting: %d chapters from youtube", len(result))
            return result

    # Path 2: AI chapter detection
    if llm_service and duration > 0 and (segments or transcript):
        result = await _detect_chapters_with_ai(
            title=video_data.get("title", ""),
            description=video_data.get("description", ""),
            transcript=transcript,
            duration=duration,
            segments=segments,
            llm_service=llm_service,
        )
        if result:
            logger.info("Chapter splitting: %d chapters from ai_detected", len(result))
            return result

    # Path 3: Time-based splitting
    if duration > 0 and segments:
        result = _time_split_chapters(duration, segments)
        if result and len(result) >= 2:
            logger.info("Chapter splitting: %d chapters from time_split", len(result))
            return result

    # Path 4: Single chunk fallback
    logger.info("Chapter splitting: 1 chapter from full (fallback)")
    return [ChapterChunk(
        index=0,
        title="Full Video",
        start_seconds=0,
        end_seconds=float(duration) if duration else 0,
        text=transcript,
        source="full",
        token_estimate=_estimate_tokens(transcript),
    )]


def _from_youtube_chapters(
    chapters: list[dict[str, Any]],
    segments: list[dict[str, Any]],
    duration: float,
) -> list[ChapterChunk] | None:
    """Convert YouTube chapters (from yt-dlp) to ChapterChunks.

    yt-dlp format: {"title": str, "start_time": float, "end_time": float}
    """
    if not chapters or len(chapters) < 2:
        return None

    result: list[ChapterChunk] = []
    for i, ch in enumerate(chapters):
        # Support both dict (raw yt-dlp) and dataclass (Chapter) objects
        if isinstance(ch, dict):
            start = ch.get("start_time", 0)
            end = ch.get("end_time", duration)
            title = ch.get("title", f"Chapter {i + 1}")
        else:
            start = getattr(ch, "start_time", 0)
            end = getattr(ch, "end_time", duration)
            title = getattr(ch, "title", f"Chapter {i + 1}")

        if segments:
            text = slice_transcript_for_chapter(
                segments,
                start_seconds=int(start),
                end_seconds=int(end),
            )
        else:
            text = ""

        if not text.strip():
            continue

        result.append(ChapterChunk(
            index=i,
            title=title,
            start_seconds=float(start),
            end_seconds=float(end),
            text=text,
            source="youtube",
            token_estimate=_estimate_tokens(text),
        ))

    return result if len(result) >= 2 else None


async def _detect_chapters_with_ai(
    title: str,
    description: str,
    transcript: str,
    duration: float,
    segments: list[dict[str, Any]],
    llm_service: LLMService,
) -> list[ChapterChunk] | None:
    """Use fast LLM to detect chapter boundaries from transcript content."""
    from pathlib import Path

    global _CHAPTER_DETECT_PROMPT
    if _CHAPTER_DETECT_PROMPT is None:
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "chapter_detect.txt"
        if not prompt_path.exists():
            logger.warning("chapter_detect.txt prompt not found, skipping AI detection")
            return None
        _CHAPTER_DETECT_PROMPT = prompt_path.read_text()

    words = transcript.split()
    first_500 = " ".join(words[:500])
    last_500 = " ".join(words[-500:]) if len(words) > 500 else ""
    duration_min = round(duration / 60)

    prompt = (
        _CHAPTER_DETECT_PROMPT
        .replace("{title}", title)
        .replace("{description}", (description or "")[:500])
        .replace("{first_500_words}", first_500)
        .replace("{last_500_words}", last_500)
        .replace("{duration_minutes}", str(duration_min))
    )

    try:
        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=2048, timeout=15.0, max_retries=1,
            stage_name="chapter_detect",
        )
        if not raw:
            return None

        data = parse_json_response(raw)
        if not data:
            return None

        # Accept both {"chapters": [...]} and bare [...]
        chapter_list = data if isinstance(data, list) else data.get("chapters", [])
        if not isinstance(chapter_list, list) or len(chapter_list) < 2:
            return None

        # Validate and build chunks
        result: list[ChapterChunk] = []
        for i, ch in enumerate(chapter_list):
            if not isinstance(ch, dict):
                continue
            start = float(ch.get("startSeconds", 0))
            end = float(ch.get("endSeconds", 0))
            ch_title = ch.get("title", f"Section {i + 1}")

            if end <= start:
                continue

            if segments:
                text = slice_transcript_for_chapter(
                    segments,
                    start_seconds=int(start),
                    end_seconds=int(end),
                )
            else:
                # Fallback: slice by word position
                total_dur = duration if duration > 0 else 1
                start_ratio = start / total_dur
                end_ratio = end / total_dur
                start_word = int(start_ratio * len(words))
                end_word = int(end_ratio * len(words))
                text = " ".join(words[start_word:end_word])

            if not text.strip():
                continue

            result.append(ChapterChunk(
                index=i,
                title=ch_title,
                start_seconds=start,
                end_seconds=end,
                text=text,
                source="ai_detected",
                token_estimate=_estimate_tokens(text),
            ))

        return result if len(result) >= 2 else None

    except Exception as e:
        logger.warning("AI chapter detection failed (non-critical): %s", e)
        return None


def _time_split_chapters(
    duration: float,
    segments: list[dict[str, Any]],
    target_minutes: float = 5.0,
) -> list[ChapterChunk]:
    """Split transcript into fixed-duration chunks (~5 minutes each).

    Args:
        duration: Video duration in seconds.
        segments: Transcript segments with startMs/endMs/text.
        target_minutes: Target chunk length in minutes.

    Returns:
        List of ChapterChunk with source="time_split".
    """
    target_seconds = target_minutes * 60
    num_chunks = max(2, round(duration / target_seconds))
    chunk_duration = duration / num_chunks

    if segments:
        sample = segments[0]
        logger.debug("time_split: %d segments, sample keys=%s, first startMs=%s",
                      len(segments), list(sample.keys()), sample.get("startMs", "MISSING"))

    result: list[ChapterChunk] = []
    for i in range(num_chunks):
        start = i * chunk_duration
        end = min((i + 1) * chunk_duration, duration)

        text = slice_transcript_for_chapter(
            segments,
            start_seconds=int(start),
            end_seconds=int(end),
        )

        if not text.strip():
            continue

        result.append(ChapterChunk(
            index=i,
            title=f"Part {i + 1}",
            start_seconds=start,
            end_seconds=end,
            text=text,
            source="time_split",
            token_estimate=_estimate_tokens(text),
        ))

    empty_count = num_chunks - len(result)
    if empty_count > 0:
        logger.warning("time_split: %d/%d chunks were empty (segments may lack startMs)", empty_count, num_chunks)

    return result
