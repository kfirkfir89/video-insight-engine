"""SSE streaming endpoint for real-time video summarization.

This module implements progressive video summarization with:
- Instant metadata and chapters via yt-dlp
- Parallel processing of description analysis, TLDR, and first section
- Batched section processing for remaining sections

Architecture follows Single Responsibility Principle:
- Each phase has its own handler function
- Main generator orchestrates phases and yields SSE events
"""

import asyncio
import json
import time
import uuid
import logging
from dataclasses import dataclass, field
from typing import Annotated, AsyncGenerator, Any

from pydantic import BaseModel

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import litellm

from src.config import settings
from src.dependencies import get_video_repository, get_llm_service, create_llm_provider
from src.models.schemas import ProcessingStatus, ErrorCode, ProviderConfig
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService, seconds_to_timestamp, build_concept_dicts, merge_chapter_concepts
from src.services.transcript import (
    get_transcript,
    clean_transcript,
)
from src.utils.transcript_slicer import slice_transcript_for_chapter
from src.services.youtube import (
    extract_video_data,
    VideoData,
    FastLLMProvider,
    classify_category_with_llm,
    get_llm_fallback_threshold,
    _select_persona,
)
from src.services.description_analyzer import analyze_description, DescriptionAnalysis
from src.services.sponsorblock import (
    get_sponsor_segments,
    filter_transcript_segments,
    sponsor_segments_to_dict,
    SponsorSegment,
)
from src.exceptions import TranscriptError
from src.services.transcript_store import transcript_store
from src.services.s3_client import s3_client, S3Client

logger = logging.getLogger(__name__)
router = APIRouter()

# Configurable batch size for parallel chapter processing
CHAPTER_BATCH_SIZE = settings.CHAPTER_BATCH_SIZE


# ─────────────────────────────────────────────────────────────────────────────
# SSE Event Helpers
# ─────────────────────────────────────────────────────────────────────────────


def sse_event(event: str, data: dict[str, Any]) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps({'event': event, **data})}\n\n"


def sse_token(phase: str, token: str, **extra: Any) -> str:
    """Format token as SSE event."""
    return f"data: {json.dumps({'event': 'token', 'phase': phase, 'token': token, **extra})}\n\n"


# ─────────────────────────────────────────────────────────────────────────────
# Data Classes for Pipeline State
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class TranscriptData:
    """Holds transcript data from any source."""
    segments: list[dict[str, Any]]
    raw_text: str
    transcript_type: str
    source: str  # ytdlp, api, proxy, whisper


@dataclass
class ParallelResults:
    """Results from parallel analysis phase."""
    description_analysis: DescriptionAnalysis | None = None
    synthesis: dict[str, Any] = field(default_factory=lambda: {"tldr": "", "keyTakeaways": []})
    first_chapter: dict[str, Any] | None = None
    concepts: list[dict[str, Any]] = field(default_factory=list)
    failed_tasks: list[str] = field(default_factory=list)


@dataclass
class PipelineContext:
    """Shared context for the summarization pipeline."""
    video_summary_id: str
    youtube_id: str
    video_data: VideoData
    transcript: TranscriptData
    persona: str
    sponsor_segments: list[SponsorSegment]
    start_time: float
    raw_transcript_ref: str | None = None  # S3 key for raw transcript


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1: Metadata & Transcript Fetching
# ─────────────────────────────────────────────────────────────────────────────


async def fetch_transcript(
    youtube_id: str,
    video_data: VideoData,
    duration: int,
) -> AsyncGenerator[str | TranscriptData, None]:
    """
    Fetch transcript using fallback chain: S3 cache → yt-dlp → API → Whisper.

    Yields SSE events for phase changes, then yields TranscriptData as final item.
    """
    # Priority 0: S3 cached transcript (avoids all YouTube calls)
    if S3Client.is_available():
        try:
            cached = await transcript_store.get(youtube_id)
            if cached:
                logger.info(f"Using S3 cached transcript: {len(cached.segments)} segments")
                yield sse_event("phase", {"phase": "transcript_cached"})
                # S3 stores normalized segments (startMs/endMs).
                # Convert to start/duration (seconds) for pipeline compatibility
                # (format_transcript_with_timestamps, sponsor filtering, etc.)
                segments = []
                for seg in cached.segments:
                    start_ms = seg.get("startMs", 0)
                    end_ms = seg.get("endMs", start_ms)
                    segments.append({
                        "text": seg.get("text", ""),
                        "start": start_ms / 1000.0,
                        "duration": (end_ms - start_ms) / 1000.0,
                    })
                raw_text = " ".join(seg["text"] for seg in segments)
                yield TranscriptData(
                    segments=segments,
                    raw_text=raw_text,
                    transcript_type=f"cached-{cached.source}",
                    source="s3",
                )
                return
        except Exception as e:
            logger.warning(f"S3 transcript retrieval failed, continuing with fallback chain: {e}")

    # Priority 1: yt-dlp subtitles
    if video_data.subtitles:
        segments = [
            {"text": seg.text, "start": seg.start, "duration": seg.duration}
            for seg in video_data.subtitles
        ]
        logger.info(f"Using yt-dlp subtitles: {len(segments)} segments")
        yield TranscriptData(
            segments=segments,
            raw_text=video_data.transcript_text,
            transcript_type="yt-dlp",
            source="ytdlp",
        )
        return

    # Priority 3: youtube-transcript-api
    logger.info("yt-dlp subtitles not available, falling back to youtube-transcript-api")
    yield sse_event("phase", {"phase": "transcript"})

    try:
        segments, raw_text, transcript_type = await get_transcript(youtube_id)
        source = "proxy" if settings.WEBSHARE_PROXY_USERNAME else "api"
        yield TranscriptData(
            segments=segments,
            raw_text=raw_text,
            transcript_type=transcript_type,
            source=source,
        )
        return
    except TranscriptError as e:
        # Priority 4: Whisper fallback for NO_TRANSCRIPT errors
        if e.code != ErrorCode.NO_TRANSCRIPT or not settings.WHISPER_ENABLED:
            raise
        if duration > settings.WHISPER_MAX_DURATION_MINUTES * 60:
            logger.warning(f"Video too long for Whisper ({duration // 60} min)")
            raise

    # Whisper transcription
    logger.info(f"No captions for {youtube_id}, trying Whisper fallback")
    yield sse_event("phase", {"phase": "whisper_transcription"})

    from src.services.whisper_transcriber import transcribe_with_whisper
    whisper_result = await transcribe_with_whisper(youtube_id)
    segments = [
        {"text": s.text, "startMs": s.startMs, "endMs": s.endMs}
        for s in whisper_result.segments
    ]
    logger.info(f"Whisper fallback successful: {len(segments)} segments")

    yield TranscriptData(
        segments=segments,
        raw_text=whisper_result.text,
        transcript_type="whisper",
        source="whisper",
    )


def validate_duration(duration: int) -> None:
    """Validate video duration against limits."""
    if duration > settings.MAX_VIDEO_DURATION_MINUTES * 60:
        raise TranscriptError(
            f"Video too long ({duration // 60} min)",
            ErrorCode.VIDEO_TOO_LONG
        )
    if duration < settings.MIN_VIDEO_DURATION_SECONDS:
        raise TranscriptError(
            f"Video too short ({duration} sec)",
            ErrorCode.VIDEO_TOO_SHORT
        )


async def finalize_video_context(
    video_data: VideoData,
    llm_provider: FastLLMProvider,
) -> VideoData:
    """Finalize video context with LLM fallback if confidence is low.

    If category detection confidence is below threshold, uses LLM
    to classify the video category. Updates VideoContext in place.

    Args:
        video_data: VideoData with initial context
        llm_provider: FastLLMProvider instance for LLM fallback

    Returns:
        VideoData with finalized context (category may be updated)
    """
    if not video_data.context:
        return video_data

    threshold = get_llm_fallback_threshold()
    confidence = video_data.context.category_confidence

    # Only call LLM if confidence is below threshold
    if confidence < threshold:
        logger.info(
            f"Low category confidence ({confidence:.2f} < {threshold}), "
            f"triggering LLM fallback for '{video_data.title}'"
        )

        new_category = await classify_category_with_llm(
            title=video_data.title,
            channel=video_data.channel,
            tags=video_data.context.tags,
            description=video_data.description,
            llm_provider=llm_provider,
        )

        # Update context with LLM-detected category
        video_data.context.category = new_category
        video_data.context.persona = _select_persona(new_category)
        video_data.context.category_confidence = 0.8  # LLM confidence is higher

        logger.info(
            f"LLM fallback: category={new_category}, persona={video_data.context.persona}"
        )

    return video_data


def extract_context(video_data: VideoData) -> tuple[dict[str, Any] | None, str]:
    """Extract video context and persona from video data.

    Category and persona are now decoupled:
    - category: detected directly via weighted scoring in youtube.py
    - persona: selected based on category, used for LLM prompts

    Returns:
        Tuple of (context_dict for storage, persona for internal LLM use).
        The context_dict contains category (user-facing), not persona (internal).
    """
    if not video_data.context:
        return None, "standard"

    # Use category directly from VideoContext (no more reverse mapping!)
    category = video_data.context.category
    persona = video_data.context.persona

    # Store category and metadata
    context_dict = {
        "category": category,
        "youtubeCategory": video_data.context.youtube_category or "Unknown",
        "tags": video_data.context.tags,
        "displayTags": video_data.context.display_tags,
    }
    logger.info(f"Video context: category={category}, persona={persona}, tags={len(video_data.context.display_tags)}")
    return context_dict, persona


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: Parallel Analysis
# ─────────────────────────────────────────────────────────────────────────────


async def run_parallel_analysis(
    llm_service: LLMService,
    video_data: VideoData,
    persona: str,
) -> AsyncGenerator[str | ParallelResults, None]:
    """
    Run parallel tasks: description analysis, TLDR, and first section.

    Concept extraction is now handled per-chapter during Phase 3.

    Yields SSE events as tasks complete, then yields ParallelResults.
    """
    yield sse_event("phase", {"phase": "parallel_analysis"})

    chapter_titles = [ch.title for ch in video_data.chapters] if video_data.has_chapters else []
    total_chapters = len(video_data.chapters) if video_data.has_chapters else 0

    # Build parallel tasks (concepts removed — now per-chapter)
    tasks: dict[str, asyncio.Task[Any]] = {
        "description": asyncio.create_task(
            analyze_description(video_data.description, fast_model=llm_service.fast_model),
            name="description"
        ),
        "tldr": asyncio.create_task(
            llm_service.generate_metadata_tldr(
                video_data.title,
                video_data.description,
                chapter_titles
            ),
            name="tldr"
        ),
    }

    # Add first chapter task if chapters exist
    # First chapter also extracts concepts (no "already extracted" list yet)
    if video_data.has_chapters and len(video_data.chapters) > 0:
        first_chapter_text = video_data.get_chapter_transcript(0)
        if first_chapter_text:
            tasks["first_chapter"] = asyncio.create_task(
                llm_service.summarize_chapter(
                    first_chapter_text,
                    video_data.chapters[0].title,
                    has_creator_title=True,
                    persona=persona,
                    extract_concepts=True,
                    total_chapters=total_chapters,
                    already_extracted_names=None,
                ),
                name="first_chapter"
            )

    # Gather results
    task_names = list(tasks.keys())
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    # Process results
    parallel_results = ParallelResults()

    for task_name, result in zip(task_names, results):
        if isinstance(result, BaseException):
            parallel_results.failed_tasks.append(task_name)
            logger.error(f"Parallel task '{task_name}' failed: {result}")
            continue

        if task_name == "description" and isinstance(result, DescriptionAnalysis):
            parallel_results.description_analysis = result
            if result.has_content:
                yield sse_event("description_analysis", result.to_dict())

        elif task_name == "tldr" and isinstance(result, dict):
            parallel_results.synthesis = result
            yield sse_event("synthesis_complete", {
                "tldr": result.get("tldr", ""),
                "keyTakeaways": result.get("keyTakeaways", []),
            })

        elif task_name == "first_chapter" and isinstance(result, dict):
            parallel_results.first_chapter = result

    if parallel_results.failed_tasks:
        yield sse_event("warning", {
            "message": f"Some analyses failed: {', '.join(parallel_results.failed_tasks)}",
            "failedTasks": parallel_results.failed_tasks,
        })

    yield parallel_results


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: Section Processing
# ─────────────────────────────────────────────────────────────────────────────


def _has_empty_content(summary_data: dict[str, Any], idx: int, title: str) -> bool:
    """Check if LLM output has empty content and log a warning."""
    content = summary_data.get("content", [])
    if not content:
        logger.warning(
            "Dropping chapter %d '%s' — empty content after LLM processing",
            idx, title,
        )
        return True
    return False


def build_chapter_dict(
    raw: dict[str, Any],
    summary_data: dict[str, Any],
    is_creator_chapter: bool,
    transcript_slice: str | None = None,
) -> dict[str, Any]:
    """Build a chapter dictionary from raw data and summary.

    Note: summary/bullets are no longer stored - they can be extracted
    on-demand from content blocks using extract_summary_from_content()
    and extract_bullets_from_content() from src.utils.content_extractor.
    """
    start = raw.get("startSeconds", raw.get("start_seconds", 0))
    end = raw.get("endSeconds", raw.get("end_seconds", start))

    chapter = {
        "id": str(uuid.uuid4()),
        "timestamp": seconds_to_timestamp(start),
        "start_seconds": start,
        "end_seconds": end,
        "title": raw.get("title", ""),
        "is_creator_chapter": is_creator_chapter,
        "content": summary_data.get("content", []),
    }

    # Add per-chapter view when present
    if summary_data.get("view"):
        chapter["view"] = summary_data["view"]

    # Add sliced transcript for RAG/display
    if transcript_slice:
        chapter["transcript"] = transcript_slice

    if is_creator_chapter:
        chapter["original_title"] = raw.get("title", "")
        chapter["generated_title"] = summary_data.get("generatedTitle")

    return chapter


def _collect_chapter_concepts(
    summary_data: dict[str, Any],
    chapter_idx: int,
    all_chapter_concepts: list[tuple[int, list[dict]]],
    already_extracted_names: list[str],
) -> None:
    """Extract concepts from a chapter result and append to the running accumulators.

    Mutates *all_chapter_concepts* and *already_extracted_names* in place.
    """
    raw_concepts = summary_data.get("concepts", [])
    if not raw_concepts:
        return
    all_chapter_concepts.append((chapter_idx, raw_concepts))
    already_extracted_names.extend(
        c.get("name", "")
        for c in raw_concepts
        if isinstance(c, dict) and c.get("name")
    )


async def process_creator_chapters(
    llm_service: LLMService,
    video_data: VideoData,
    persona: str,
    first_chapter_result: dict[str, Any] | None,
    normalized_segments: list[dict[str, Any]],
) -> AsyncGenerator[str | dict[str, Any], None]:
    """
    Process creator-defined chapters with per-chapter concept extraction.

    Concept anchoring is derived from already-extracted names: chapters 2+
    get anchoring from prior chapters' concepts so the LLM uses consistent
    terminology for inline highlighting.

    Yields SSE events for each chapter, then yields a dict with:
    - "chapters": list of chapter dicts
    - "concepts": merged, deduplicated concept list
    """
    yield sse_event("phase", {"phase": "chapter_summaries"})

    chapters_result: list[dict[str, Any]] = []
    video_chapters = video_data.chapters
    total_chapters = len(video_chapters)

    # Track per-chapter concepts for merge
    all_chapter_concepts: list[tuple[int, list[dict]]] = []
    already_extracted_names: list[str] = []

    # Build raw chapters from video chapters
    raw_chapters = [
        {
            "title": ch.title,
            "startSeconds": int(ch.start_time),
            "endSeconds": int(ch.end_time),
        }
        for ch in video_chapters
    ]

    # Collect concepts from first chapter regardless of content status
    # (mutates all_chapter_concepts and already_extracted_names in place)
    if first_chapter_result:
        _collect_chapter_concepts(
            first_chapter_result, 0, all_chapter_concepts, already_extracted_names,
        )

    # Add first chapter if already processed (drop if empty content)
    if first_chapter_result and first_chapter_result.get("content"):
        first_ch = video_chapters[0]
        transcript_slice = slice_transcript_for_chapter(
            normalized_segments, int(first_ch.start_time), int(first_ch.end_time)
        )
        chapter = build_chapter_dict(
            {"title": first_ch.title, "startSeconds": int(first_ch.start_time), "endSeconds": int(first_ch.end_time)},
            first_chapter_result,
            is_creator_chapter=True,
            transcript_slice=transcript_slice,
        )
        chapters_result.append(chapter)
        yield sse_event("chapter_ready", {"index": 0, "chapter": chapter})
    elif first_chapter_result:
        logger.warning("Dropping chapter 0 '%s' — empty content", video_chapters[0].title)

    # Process remaining chapters in batches
    start_idx = 1 if first_chapter_result else 0
    remaining_indices = list(range(start_idx, len(raw_chapters)))

    for batch_start in range(0, len(remaining_indices), CHAPTER_BATCH_SIZE):
        batch_indices = remaining_indices[batch_start:batch_start + CHAPTER_BATCH_SIZE]
        batch_tasks: list[tuple[int, dict[str, Any], asyncio.Task[Any]]] = []

        # Snapshot: all tasks in a batch see the same already-extracted list.
        # Intra-batch duplicates are expected and handled by merge_chapter_concepts().
        batch_already_extracted = list(already_extracted_names)

        for idx in batch_indices:
            raw = raw_chapters[idx]
            chapter_text = video_data.get_chapter_transcript(idx)
            if chapter_text:
                task = asyncio.create_task(
                    llm_service.summarize_chapter(
                        chapter_text,
                        raw["title"],
                        has_creator_title=True,
                        persona=persona,
                        concept_names=batch_already_extracted or None,
                        extract_concepts=True,
                        total_chapters=total_chapters,
                        already_extracted_names=batch_already_extracted,
                    )
                )
                batch_tasks.append((idx, raw, task))

        for idx, raw, task in batch_tasks:
            try:
                summary_data = await task
                _collect_chapter_concepts(
                    summary_data, idx, all_chapter_concepts, already_extracted_names,
                )

                if _has_empty_content(summary_data, idx, raw.get("title", "")):
                    continue
                transcript_slice = slice_transcript_for_chapter(
                    normalized_segments, raw["startSeconds"], raw["endSeconds"]
                )
                chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=True, transcript_slice=transcript_slice)
                chapters_result.append(chapter)
                yield sse_event("chapter_ready", {"index": idx, "chapter": chapter})
            except Exception as e:
                logger.error(f"Chapter {idx} processing error: {e}")

    # Merge all chapter concepts with fuzzy dedup
    concepts = merge_chapter_concepts(all_chapter_concepts)
    logger.info(f"Per-chapter concept extraction: {sum(len(c) for _, c in all_chapter_concepts)} raw → {len(concepts)} merged")

    yield {"chapters": chapters_result, "concepts": concepts}


async def process_ai_chapters(
    llm_service: LLMService,
    segments: list[dict[str, Any]],
    clean_text: str,
    duration: int,
    persona: str,
    normalized_segments: list[dict[str, Any]],
) -> AsyncGenerator[str | dict[str, Any], None]:
    """
    Detect and process chapters using AI (fallback when no creator chapters).
    Includes per-chapter concept extraction with fuzzy dedup.

    Concept anchoring is derived from already-extracted names so subsequent
    chapters use consistent terminology for inline highlighting.

    Yields SSE events for progress, then yields a dict with:
    - "chapters": list of chapter dicts
    - "concepts": merged, deduplicated concept list
    """
    yield sse_event("phase", {"phase": "chapter_detect"})

    # Detect chapters via streaming LLM
    raw_chapters: list[dict[str, Any]] = []
    async for event_type, data in llm_service.stream_detect_chapters(clean_text, segments, duration):
        if event_type == "token":
            yield sse_token("chapter_detect", str(data))
        else:
            raw_chapters = data if isinstance(data, list) else []

    # Clamp timestamps to valid range
    for chapter in raw_chapters:
        chapter["startSeconds"] = max(0, min(chapter.get("startSeconds", 0), duration))
        chapter["endSeconds"] = max(0, min(chapter.get("endSeconds", duration), duration))

    yield sse_event("chapters_detected", {
        "count": len(raw_chapters),
        "chapters": [{"title": ch.get("title"), "startSeconds": ch.get("startSeconds")} for ch in raw_chapters]
    })
    yield sse_event("phase", {"phase": "chapter_summaries"})

    # Process chapters in batches with per-chapter concept extraction
    chapters_result: list[dict[str, Any]] = []
    total_chapters = len(raw_chapters)
    all_chapter_concepts: list[tuple[int, list[dict]]] = []
    already_extracted_names: list[str] = []

    for batch_start in range(0, len(raw_chapters), CHAPTER_BATCH_SIZE):
        batch = raw_chapters[batch_start:batch_start + CHAPTER_BATCH_SIZE]
        batch_tasks: list[tuple[int, dict[str, Any], int, int, asyncio.Task[Any]]] = []

        # Snapshot for this batch
        batch_already_extracted = list(already_extracted_names)

        for i, raw in enumerate(batch):
            idx = batch_start + i
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", 0) or (start + 300)
            chapter_segments = [s for s in segments if start <= s.get("start", 0) < end]
            chapter_text = " ".join([s.get("text", "") for s in chapter_segments])

            task = asyncio.create_task(
                llm_service.summarize_chapter(
                    chapter_text,
                    raw.get("title", ""),
                    persona=persona,
                    concept_names=batch_already_extracted or None,
                    extract_concepts=True,
                    total_chapters=total_chapters,
                    already_extracted_names=batch_already_extracted,
                )
            )
            batch_tasks.append((idx, raw, start, end, task))

        for idx, raw, start, end, task in batch_tasks:
            try:
                summary_data = await task
                _collect_chapter_concepts(
                    summary_data, idx, all_chapter_concepts, already_extracted_names,
                )

                if _has_empty_content(summary_data, idx, raw.get("title", "")):
                    continue
                transcript_slice = slice_transcript_for_chapter(normalized_segments, start, end)
                chapter = build_chapter_dict(
                    {"title": raw.get("title", ""), "startSeconds": start, "endSeconds": end},
                    summary_data,
                    is_creator_chapter=False,
                    transcript_slice=transcript_slice,
                )
                chapters_result.append(chapter)
                yield sse_event("chapter_ready", {"index": idx, "chapter": chapter})
            except Exception as e:
                logger.error(f"Chapter {idx} processing error: {e}")

    # Merge all chapter concepts with fuzzy dedup
    concepts = merge_chapter_concepts(all_chapter_concepts)
    logger.info(f"Per-chapter concept extraction: {sum(len(c) for _, c in all_chapter_concepts)} raw → {len(concepts)} merged")

    yield {"chapters": chapters_result, "concepts": concepts}


# ─────────────────────────────────────────────────────────────────────────────
# Phase 4: Concept Extraction
# ─────────────────────────────────────────────────────────────────────────────


async def extract_concepts(
    llm_service: LLMService,
    timestamped_transcript: str,
) -> AsyncGenerator[str | list[dict[str, Any]], None]:
    """
    Extract key concepts from transcript.

    Yields SSE events, then yields concepts list.
    """
    yield sse_event("phase", {"phase": "concepts"})

    raw_concepts: list[dict[str, Any]] = []
    async for event_type, data in llm_service.stream_extract_concepts(timestamped_transcript):
        if event_type == "token":
            yield sse_token("concepts", str(data))
        else:
            raw_concepts = data if isinstance(data, list) else []

    logger.debug(f"Extracted {len(raw_concepts)} concepts")

    concepts = build_concept_dicts(raw_concepts)

    yield sse_event("concepts_complete", {"concepts": concepts})
    yield concepts


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: Master Summary
# ─────────────────────────────────────────────────────────────────────────────


async def generate_master_summary(
    llm_service: LLMService,
    video_data: VideoData,
    duration: int,
    persona: str,
    synthesis: dict[str, Any],
    chapters: list[dict[str, Any]],
    concepts: list[dict[str, Any]],
) -> AsyncGenerator[str | None, None]:
    """
    Generate master summary. Non-fatal on failure.

    Yields SSE events, then yields the master summary or None.
    """
    yield sse_event("phase", {"phase": "master_summary"})

    try:
        master_summary = await llm_service.generate_master_summary(
            title=video_data.title,
            channel=video_data.channel or "",
            duration=duration,
            persona=persona,
            tldr=synthesis.get("tldr", ""),
            key_takeaways=synthesis.get("keyTakeaways", []),
            chapters=chapters,
            concepts=concepts,
        )
        yield sse_event("master_summary_complete", {"masterSummary": master_summary})
        logger.debug(f"Master summary generated: {len(master_summary)} chars")
        yield master_summary
    except (litellm.exceptions.RateLimitError, litellm.exceptions.APIConnectionError, TimeoutError) as e:
        logger.warning(f"Master summary skipped ({type(e).__name__}): {e}")
        yield None
    except (litellm.exceptions.AuthenticationError, litellm.exceptions.APIError) as e:
        logger.error(f"Master summary failed ({type(e).__name__}): {e}")
        yield None


# ─────────────────────────────────────────────────────────────────────────────
# Result Building
# ─────────────────────────────────────────────────────────────────────────────


def normalize_segments(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert segments to normalized format with milliseconds."""
    normalized = []
    for seg in segments:
        if "startMs" in seg:
            # Browser/Whisper format - already in milliseconds
            start_ms = int(seg["startMs"])
            end_ms = int(seg.get("endMs", start_ms))
        else:
            # yt-dlp/API format - convert from seconds
            start_s = seg.get("start", 0)
            duration_s = seg.get("duration", 0)
            start_ms = int(start_s * 1000)
            end_ms = int((start_s + duration_s) * 1000)

        normalized.append({
            "text": seg.get("text", ""),
            "startMs": start_ms,
            "endMs": end_ms,
        })
    return normalized


def build_result(
    ctx: PipelineContext,
    synthesis: dict[str, Any],
    chapters: list[dict[str, Any]],
    concepts: list[dict[str, Any]],
    master_summary: str | None,
    description_analysis: DescriptionAnalysis | None,
    context_dict: dict[str, Any] | None,
    llm_model: str,
) -> dict[str, Any]:
    """Build the final result dictionary for storage."""
    from datetime import datetime, timezone
    processing_time = int((time.time() - ctx.start_time) * 1000)

    result: dict[str, Any] = {
        "title": ctx.video_data.title,
        "channel": ctx.video_data.channel,
        "duration": ctx.video_data.duration,
        "thumbnail_url": ctx.video_data.thumbnail_url,
        "transcript": ctx.transcript.raw_text,
        "transcript_type": ctx.transcript.transcript_type,
        "transcript_segments": normalize_segments(ctx.transcript.segments),
        "transcript_source": ctx.transcript.source,
        "summary": {
            "tldr": synthesis.get("tldr", ""),
            "key_takeaways": synthesis.get("keyTakeaways", []),
            "chapters": chapters,
            "concepts": concepts,
            "master_summary": master_summary,
        },
        "processing_time_ms": processing_time,
        "token_usage": {},
    }

    # Add S3 reference for raw transcript (for regeneration)
    if ctx.raw_transcript_ref:
        result["raw_transcript_ref"] = ctx.raw_transcript_ref

    # Add generation metadata (for regeneration tracking)
    result["generation"] = {
        "model": llm_model,
        "prompt_version": settings.PROMPT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Add chapters if available
    if ctx.video_data.has_chapters:
        result["chapters"] = [
            {
                "startSeconds": int(ch.start_time),
                "endSeconds": int(ch.end_time),
                "title": ch.title,
                "isCreatorChapter": True,
            }
            for ch in ctx.video_data.chapters
        ]
        result["chapter_source"] = "creator"

    # Add optional data
    if description_analysis and description_analysis.has_content:
        result["description_analysis"] = description_analysis.to_dict()

    if ctx.sponsor_segments:
        result["sponsor_segments"] = sponsor_segments_to_dict(ctx.sponsor_segments)

    if context_dict:
        result["context"] = context_dict

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Main Streaming Generator
# ─────────────────────────────────────────────────────────────────────────────


async def stream_summarization(
    video_summary_id: str,
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
) -> AsyncGenerator[str, None]:
    """
    Stream the video summarization process as SSE events.

    Phases:
    1. INSTANT: Metadata + chapters via yt-dlp
    2. PARALLEL: Description analysis + TLDR + first section + concepts
    3. SECTIONS: Remaining sections in batches (with concept anchoring)
    4. MASTER: Master summary generation
    """
    start_time = time.time()

    try:
        # ── Validate Entry ──
        entry = repository.get_video_summary(video_summary_id)
        if not entry:
            yield sse_event("error", {"message": "Video summary not found"})
            return

        youtube_id = entry.get("youtubeId") or entry.get("youtube_id")
        if not youtube_id:
            yield sse_event("error", {"message": "YouTube ID not found"})
            return

        repository.update_status(video_summary_id, ProcessingStatus.PROCESSING)

        # ── Phase 1: Metadata ──
        yield sse_event("phase", {"phase": "metadata"})
        video_data = await extract_video_data(youtube_id)

        # Finalize context with LLM fallback if confidence is low
        video_data = await finalize_video_context(video_data, llm_service.provider)
        context_dict, persona = extract_context(video_data)

        yield sse_event("metadata", {
            "title": video_data.title,
            "channel": video_data.channel,
            "thumbnailUrl": video_data.thumbnail_url,
            "duration": video_data.duration,
            "context": context_dict,
        })

        # Sponsor segments
        sponsor_segments = await get_sponsor_segments(youtube_id)
        if sponsor_segments:
            yield sse_event("sponsor_segments", {
                "segments": sponsor_segments_to_dict(sponsor_segments),
                "totalDurationRemoved": sum(s.end_seconds - s.start_seconds for s in sponsor_segments),
            })

        logger.info(f"Processing chapters: has_chapters={video_data.has_chapters}")

        # Chapters
        if video_data.has_chapters:
            yield sse_event("chapters", {
                "chapters": [
                    {"startSeconds": int(ch.start_time), "endSeconds": int(ch.end_time), "title": ch.title}
                    for ch in video_data.chapters
                ],
                "isCreatorChapters": True,
            })

        # Validate duration
        logger.info(f"Validating duration: {video_data.duration} seconds ({video_data.duration // 60} min)")
        validate_duration(video_data.duration)
        logger.info("Duration validation passed")

        # ── Fetch Transcript ──
        transcript_data: TranscriptData | None = None

        async for item in fetch_transcript(youtube_id, video_data, video_data.duration):
            if isinstance(item, str):
                yield item  # SSE event
            else:
                transcript_data = item

        if not transcript_data:
            raise TranscriptError("Failed to fetch transcript", ErrorCode.NO_TRANSCRIPT)

        yield sse_event("transcript_ready", {"duration": video_data.duration})

        # Normalize segments for consistent handling
        normalized_segments = normalize_segments(transcript_data.segments)

        # Store raw transcript in S3 BEFORE sponsor filtering
        # Skip if already loaded from S3 (resummarize/retry)
        raw_transcript_ref: str | None = None
        if transcript_data.source == "s3":
            raw_transcript_ref = f"transcripts/{youtube_id}.json"
            logger.debug("Transcript loaded from S3, skipping re-store")
        else:
            try:
                raw_transcript_ref = await transcript_store.store(
                    youtube_id=youtube_id,
                    segments=normalized_segments,
                    source=transcript_data.source,  # type: ignore[arg-type]
                    language=None,  # TODO: detect language from yt-dlp
                )
                logger.debug(f"Stored transcript in S3: {raw_transcript_ref}")
            except Exception as e:
                logger.warning(f"Failed to store transcript in S3: {e}")

        # Filter sponsor content
        segments = transcript_data.segments
        if sponsor_segments:
            original_count = len(segments)
            segments = filter_transcript_segments(segments, sponsor_segments)
            transcript_data.segments = segments
            transcript_data.raw_text = " ".join(seg.get("text", "") for seg in segments)
            # Re-normalize after filtering
            normalized_segments = normalize_segments(segments)
            logger.info(f"Filtered transcript: {original_count} -> {len(segments)} segments")

        clean_text = clean_transcript(transcript_data.raw_text)

        # Build pipeline context
        ctx = PipelineContext(
            video_summary_id=video_summary_id,
            youtube_id=youtube_id,
            video_data=video_data,
            transcript=transcript_data,
            persona=persona,
            sponsor_segments=sponsor_segments,
            start_time=start_time,
            raw_transcript_ref=raw_transcript_ref,
        )

        # ── Phase 2: Parallel Analysis (TLDR + first chapter with concepts) ──
        parallel_results: ParallelResults | None = None
        async for item in run_parallel_analysis(
            llm_service, video_data, persona,
        ):
            if isinstance(item, str):
                yield item
            else:
                parallel_results = item

        synthesis = parallel_results.synthesis if parallel_results else {"tldr": "", "keyTakeaways": []}
        description_analysis = parallel_results.description_analysis if parallel_results else None
        first_chapter_result = parallel_results.first_chapter if parallel_results else None

        # ── Phase 3: Chapters with per-chapter concept extraction ──
        chapters: list[dict[str, Any]] = []
        concepts: list[dict[str, Any]] = []

        if video_data.has_chapters:
            async for item in process_creator_chapters(
                llm_service, video_data, persona, first_chapter_result,
                normalized_segments,
            ):
                if isinstance(item, str):
                    yield item
                elif isinstance(item, dict):
                    chapters = item.get("chapters", [])
                    concepts = item.get("concepts", [])
        else:
            async for item in process_ai_chapters(
                llm_service, segments, clean_text, video_data.duration, persona,
                normalized_segments,
            ):
                if isinstance(item, str):
                    yield item
                elif isinstance(item, dict):
                    chapters = item.get("chapters", [])
                    concepts = item.get("concepts", [])

        # Emit concepts after all chapters processed
        if concepts:
            yield sse_event("concepts_complete", {"concepts": concepts})

        # ── Phase 4: Master Summary ──
        master_summary: str | None = None
        async for item in generate_master_summary(
            llm_service, video_data, video_data.duration, persona, synthesis, chapters, concepts
        ):
            if isinstance(item, str) and item.startswith("data:"):
                yield item
            elif item is None or isinstance(item, str):
                master_summary = item

        # ── Save Results ──
        result = build_result(
            ctx, synthesis, chapters, concepts, master_summary,
            description_analysis, context_dict, llm_service.provider.model
        )
        repository.save_result(video_summary_id, result)

        processing_time = int((time.time() - start_time) * 1000)
        yield sse_event("done", {"videoSummaryId": video_summary_id, "processingTimeMs": processing_time})
        yield "data: [DONE]\n\n"

    except TranscriptError as e:
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        yield sse_event("error", {"message": str(e), "code": e.code.value})

    except litellm.RateLimitError as e:
        logger.warning(f"Rate limited for {video_summary_id}: {e}")
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.RATE_LIMITED)
        yield sse_event("error", {"message": "AI service rate limited. Please try again in a moment.", "code": ErrorCode.RATE_LIMITED.value})

    except litellm.Timeout as e:
        logger.warning(f"LLM timeout for {video_summary_id}: {e}")
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "Request took too long. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except litellm.APIError as e:
        logger.error(f"LLM API error for {video_summary_id}: {e}")
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "AI service error. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except Exception as e:
        import traceback
        logger.error(f"Stream error for {video_summary_id}: {e}\n{traceback.format_exc()}")

        # Map common exception types to error codes for better frontend UX
        error_code = ErrorCode.UNKNOWN_ERROR
        error_str = str(e).lower()

        if "timeout" in error_str or "timed out" in error_str:
            error_code = ErrorCode.LLM_ERROR
        elif "rate limit" in error_str or "429" in error_str:
            error_code = ErrorCode.RATE_LIMITED
        elif "transcript" in error_str or "caption" in error_str:
            error_code = ErrorCode.NO_TRANSCRIPT

        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), error_code)
        yield sse_event("error", {"message": str(e), "code": error_code.value})


# ─────────────────────────────────────────────────────────────────────────────
# Route Handler
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/summarize/stream/{video_summary_id}")
async def stream_summary(
    video_summary_id: str,
    repository: Annotated[MongoDBVideoRepository, Depends(get_video_repository)],
    llm_service: Annotated[LLMService, Depends(get_llm_service)],
):
    """
    Stream video summarization via Server-Sent Events.

    Progressive architecture delivers content in phases:
    1. INSTANT (~1 sec): Metadata + chapters from yt-dlp
    2. PARALLEL (~2-5 sec): Description analysis + TLDR + first section + concepts
    3. SECTIONS: Remaining sections in batches (with concept anchoring)
    4. MASTER: Master summary generation
    """
    # Validate ObjectId format
    try:
        ObjectId(video_summary_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid video summary ID format")

    entry = repository.get_video_summary(video_summary_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Video summary not found")

    # Check for provider config override (dev tools)
    provider_config = entry.get("providerConfig")
    if provider_config:
        logger.info(f"Using custom provider config: {provider_config}")
        providers = ProviderConfig(
            default=provider_config.get("default", "anthropic"),
            fast=provider_config.get("fast"),
            fallback=provider_config.get("fallback"),
        )
        custom_provider = create_llm_provider(providers)
        llm_service = LLMService(custom_provider)

    # Return cached result if already completed
    if entry.get("status") == ProcessingStatus.COMPLETED.value:
        return StreamingResponse(
            _stream_cached_result(video_summary_id, entry),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    # Stream new summarization
    return StreamingResponse(
        stream_summarization(video_summary_id, repository, llm_service),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


async def _stream_cached_result(video_summary_id: str, entry: dict[str, Any]) -> AsyncGenerator[str, None]:
    """Stream a cached result as SSE events."""
    yield sse_event("cached", {"videoSummaryId": video_summary_id})
    yield sse_event("metadata", {
        "title": entry.get("title"),
        "channel": entry.get("channel"),
        "thumbnailUrl": entry.get("thumbnail_url"),
        "duration": entry.get("duration"),
        "context": entry.get("context"),
    })

    if chapters := entry.get("chapters"):
        yield sse_event("chapters", {
            "chapters": chapters,
            "isCreatorChapters": entry.get("chapter_source") == "creator",
        })

    if desc_analysis := entry.get("description_analysis"):
        yield sse_event("description_analysis", desc_analysis)

    summary = entry.get("summary", {})
    yield sse_event("synthesis_complete", {
        "tldr": summary.get("tldr", ""),
        "keyTakeaways": summary.get("key_takeaways", []),
    })

    for i, chapter in enumerate(summary.get("chapters", [])):
        yield sse_event("chapter_ready", {"index": i, "chapter": chapter})

    yield sse_event("concepts_complete", {"concepts": summary.get("concepts", [])})

    if master_summary := summary.get("master_summary"):
        yield sse_event("master_summary_complete", {"masterSummary": master_summary})

    yield sse_event("done", {"videoSummaryId": video_summary_id, "cached": True})
    yield "data: [DONE]\n\n"


# ─────────────────────────────────────────────────────────────────────────────
# Regeneration Endpoint
# ─────────────────────────────────────────────────────────────────────────────


class RegenerateRequest(BaseModel):
    """Request body for regeneration endpoint."""
    force: bool = False  # Force regenerate even without S3 transcript


class RegenerateResponse(BaseModel):
    """Response for regeneration endpoint."""
    status: str
    video_summary_id: str
    message: str
    has_raw_transcript: bool = False
    generation: dict[str, Any] | None = None


@router.post("/regenerate/{video_summary_id}", response_model=RegenerateResponse)
async def regenerate_summary(
    video_summary_id: str,
    request: RegenerateRequest,
    repository: Annotated[MongoDBVideoRepository, Depends(get_video_repository)],
):
    """
    Trigger regeneration of a video summary.

    This endpoint:
    1. Validates the video summary exists
    2. Checks if raw transcript is available in S3
    3. Resets status to allow re-processing via streaming endpoint

    The actual regeneration happens when the client connects to the
    streaming endpoint (GET /summarize/stream/{video_summary_id}).

    Args:
        video_summary_id: The video summary ID to regenerate
        request: Optional request body with force flag

    Returns:
        Status of regeneration request
    """
    # Validate ObjectId format
    try:
        ObjectId(video_summary_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid video summary ID format")

    # Check if video summary exists
    entry = repository.get_video_summary(video_summary_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Video summary not found")

    # Check if raw transcript is available in S3
    has_raw_transcript = False
    raw_transcript_ref = entry.get("rawTranscriptRef")

    if raw_transcript_ref and s3_client.is_available():
        try:
            has_raw_transcript = await s3_client.exists(raw_transcript_ref)
        except Exception as e:
            logger.warning(f"Failed to check S3 transcript: {e}")

    # If no raw transcript and not forcing, return error
    if not has_raw_transcript and not request.force:
        return RegenerateResponse(
            status="unavailable",
            video_summary_id=video_summary_id,
            message="Raw transcript not available in S3. Use force=true to re-fetch from YouTube.",
            has_raw_transcript=False,
            generation=entry.get("generation"),
        )

    # Reset status to pending to allow re-processing
    repository.update_status(video_summary_id, ProcessingStatus.PENDING)

    return RegenerateResponse(
        status="ready",
        video_summary_id=video_summary_id,
        message="Video summary ready for regeneration. Connect to streaming endpoint to process.",
        has_raw_transcript=has_raw_transcript,
        generation=entry.get("generation"),
    )
