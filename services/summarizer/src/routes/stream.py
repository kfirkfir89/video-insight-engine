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

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import litellm

from src.config import settings
from src.dependencies import get_video_repository, get_llm_service, create_llm_provider
from src.models.schemas import ProcessingStatus, ErrorCode, ProviderConfig
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService, seconds_to_timestamp
from src.services.transcript import (
    get_transcript,
    clean_transcript,
    format_transcript_with_timestamps,
)
from src.services.youtube import extract_video_data, VideoData
from src.services.description_analyzer import analyze_description, DescriptionAnalysis
from src.services.sponsorblock import (
    get_sponsor_segments,
    filter_transcript_segments,
    sponsor_segments_to_dict,
    SponsorSegment,
)
from src.exceptions import TranscriptError

logger = logging.getLogger(__name__)
router = APIRouter()

# Configurable batch size for parallel section processing
SECTION_BATCH_SIZE = settings.SECTION_BATCH_SIZE


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
    first_section: dict[str, Any] | None = None
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


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1: Metadata & Transcript Fetching
# ─────────────────────────────────────────────────────────────────────────────


async def fetch_transcript(
    youtube_id: str,
    video_data: VideoData,
    duration: int,
) -> AsyncGenerator[str | TranscriptData, None]:
    """
    Fetch transcript using fallback chain: yt-dlp → API → Whisper.

    Yields SSE events for phase changes, then yields TranscriptData as final item.
    """
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


def extract_context(video_data: VideoData) -> tuple[dict[str, Any] | None, str]:
    """Extract video context and persona from video data."""
    if not video_data.context:
        return None, "standard"

    context_dict = {
        "youtubeCategory": video_data.context.youtube_category or "Unknown",
        "persona": video_data.context.persona,
        "tags": video_data.context.tags,
        "displayTags": video_data.context.display_tags,
    }
    logger.info(f"Video context: persona={video_data.context.persona}, tags={len(video_data.context.display_tags)}")
    return context_dict, video_data.context.persona


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

    Yields SSE events as tasks complete, then yields ParallelResults.
    """
    yield sse_event("phase", {"phase": "parallel_analysis"})

    chapter_titles = [ch.title for ch in video_data.chapters] if video_data.has_chapters else []

    # Build parallel tasks
    tasks: dict[str, asyncio.Task[Any]] = {
        "description": asyncio.create_task(
            analyze_description(video_data.description),
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

    # Add first section task if chapters exist
    if video_data.has_chapters and len(video_data.chapters) > 0:
        first_section_text = video_data.get_chapter_transcript(0)
        if first_section_text:
            tasks["first_section"] = asyncio.create_task(
                llm_service.summarize_section(
                    first_section_text,
                    video_data.chapters[0].title,
                    has_creator_title=True,
                    persona=persona,
                ),
                name="first_section"
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

        elif task_name == "first_section" and isinstance(result, dict):
            parallel_results.first_section = result

    if parallel_results.failed_tasks:
        yield sse_event("warning", {
            "message": f"Some analyses failed: {', '.join(parallel_results.failed_tasks)}",
            "failedTasks": parallel_results.failed_tasks,
        })

    yield parallel_results


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: Section Processing
# ─────────────────────────────────────────────────────────────────────────────


def build_section_dict(
    raw: dict[str, Any],
    summary_data: dict[str, Any],
    is_creator_chapter: bool,
) -> dict[str, Any]:
    """Build a section dictionary from raw data and summary."""
    start = raw.get("startSeconds", raw.get("start_seconds", 0))
    end = raw.get("endSeconds", raw.get("end_seconds", start))

    section = {
        "id": str(uuid.uuid4()),
        "timestamp": seconds_to_timestamp(start),
        "start_seconds": start,
        "end_seconds": end,
        "title": raw.get("title", ""),
        "is_creator_chapter": is_creator_chapter,
        "content": summary_data.get("content", []),
        "summary": summary_data.get("summary", ""),
        "bullets": summary_data.get("bullets", []),
    }

    if is_creator_chapter:
        section["original_title"] = raw.get("title", "")
        section["generated_title"] = summary_data.get("generatedTitle")

    return section


async def process_creator_sections(
    llm_service: LLMService,
    video_data: VideoData,
    persona: str,
    first_section_result: dict[str, Any] | None,
) -> AsyncGenerator[str | list[dict[str, Any]], None]:
    """
    Process creator-defined chapters as sections.

    Yields SSE events for each section, then yields the sections list.
    """
    yield sse_event("phase", {"phase": "section_summaries"})

    sections: list[dict[str, Any]] = []
    chapters = video_data.chapters

    # Build raw sections from chapters
    raw_sections = [
        {
            "title": ch.title,
            "startSeconds": int(ch.start_time),
            "endSeconds": int(ch.end_time),
        }
        for ch in chapters
    ]

    # Add first section if already processed
    if first_section_result:
        first_ch = chapters[0]
        section = build_section_dict(
            {"title": first_ch.title, "startSeconds": int(first_ch.start_time), "endSeconds": int(first_ch.end_time)},
            first_section_result,
            is_creator_chapter=True,
        )
        sections.append(section)
        yield sse_event("section_ready", {"index": 0, "section": section})

    # Process remaining sections in batches
    start_idx = 1 if first_section_result else 0
    remaining_indices = list(range(start_idx, len(raw_sections)))

    for batch_start in range(0, len(remaining_indices), SECTION_BATCH_SIZE):
        batch_indices = remaining_indices[batch_start:batch_start + SECTION_BATCH_SIZE]
        batch_tasks: list[tuple[int, dict[str, Any], asyncio.Task[Any]]] = []

        for idx in batch_indices:
            raw = raw_sections[idx]
            section_text = video_data.get_chapter_transcript(idx)
            if section_text:
                task = asyncio.create_task(
                    llm_service.summarize_section(
                        section_text,
                        raw["title"],
                        has_creator_title=True,
                        persona=persona,
                    )
                )
                batch_tasks.append((idx, raw, task))

        for idx, raw, task in batch_tasks:
            try:
                summary_data = await task
                section = build_section_dict(raw, summary_data, is_creator_chapter=True)
                sections.append(section)
                yield sse_event("section_ready", {"index": idx, "section": section})
            except Exception as e:
                logger.error(f"Section {idx} processing error: {e}")

    yield sections


async def process_ai_sections(
    llm_service: LLMService,
    segments: list[dict[str, Any]],
    clean_text: str,
    duration: int,
    persona: str,
) -> AsyncGenerator[str | list[dict[str, Any]], None]:
    """
    Detect and process sections using AI (fallback when no chapters).

    Yields SSE events for progress, then yields the sections list.
    """
    yield sse_event("phase", {"phase": "section_detect"})

    # Detect sections via streaming LLM
    raw_sections: list[dict[str, Any]] = []
    async for event_type, data in llm_service.stream_detect_sections(clean_text, segments, duration):
        if event_type == "token":
            yield sse_token("section_detect", str(data))
        else:
            raw_sections = data if isinstance(data, list) else []

    # Clamp timestamps to valid range
    for section in raw_sections:
        section["startSeconds"] = max(0, min(section.get("startSeconds", 0), duration))
        section["endSeconds"] = max(0, min(section.get("endSeconds", duration), duration))

    yield sse_event("sections_detected", {
        "count": len(raw_sections),
        "sections": [{"title": s.get("title"), "startSeconds": s.get("startSeconds")} for s in raw_sections]
    })
    yield sse_event("phase", {"phase": "section_summaries"})

    # Process sections in batches
    sections: list[dict[str, Any]] = []

    for batch_start in range(0, len(raw_sections), SECTION_BATCH_SIZE):
        batch = raw_sections[batch_start:batch_start + SECTION_BATCH_SIZE]
        batch_tasks: list[tuple[int, dict[str, Any], int, int, asyncio.Task[Any]]] = []

        for i, raw in enumerate(batch):
            idx = batch_start + i
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", start + 300)
            section_segments = [s for s in segments if start <= s.get("start", 0) <= end]
            section_text = " ".join([s.get("text", "") for s in section_segments])

            task = asyncio.create_task(
                llm_service.summarize_section(section_text, raw.get("title", ""), persona=persona)
            )
            batch_tasks.append((idx, raw, start, end, task))

        for idx, raw, start, end, task in batch_tasks:
            try:
                summary_data = await task
                section = build_section_dict(
                    {"title": raw.get("title", ""), "startSeconds": start, "endSeconds": end},
                    summary_data,
                    is_creator_chapter=False,
                )
                sections.append(section)
                yield sse_event("section_ready", {"index": idx, "section": section})
            except Exception as e:
                logger.error(f"Section {idx} processing error: {e}")

    yield sections


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

    concepts = [
        {
            "id": str(uuid.uuid4()),
            "name": c.get("name", ""),
            "definition": c.get("definition"),
            "timestamp": c.get("timestamp"),
        }
        for c in raw_concepts
    ]

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
    sections: list[dict[str, Any]],
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
            sections=sections,
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
    sections: list[dict[str, Any]],
    concepts: list[dict[str, Any]],
    master_summary: str | None,
    description_analysis: DescriptionAnalysis | None,
    context_dict: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build the final result dictionary for storage."""
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
            "sections": sections,
            "concepts": concepts,
            "master_summary": master_summary,
        },
        "processing_time_ms": processing_time,
        "token_usage": {},
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
    2. PARALLEL: Description analysis + TLDR + first section
    3. SECTIONS: Remaining sections in batches
    4. CONCEPTS: Key concept extraction
    5. MASTER: Master summary generation
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
        validate_duration(video_data.duration)

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

        # Filter sponsor content
        segments = transcript_data.segments
        if sponsor_segments:
            original_count = len(segments)
            segments = filter_transcript_segments(segments, sponsor_segments)
            transcript_data.segments = segments
            transcript_data.raw_text = " ".join(seg.get("text", "") for seg in segments)
            logger.info(f"Filtered transcript: {original_count} -> {len(segments)} segments")

        clean_text = clean_transcript(transcript_data.raw_text)
        timestamped_transcript = format_transcript_with_timestamps(segments)

        # Build pipeline context
        ctx = PipelineContext(
            video_summary_id=video_summary_id,
            youtube_id=youtube_id,
            video_data=video_data,
            transcript=transcript_data,
            persona=persona,
            sponsor_segments=sponsor_segments,
            start_time=start_time,
        )

        # ── Phase 2: Parallel Analysis ──
        parallel_results: ParallelResults | None = None
        async for item in run_parallel_analysis(llm_service, video_data, persona):
            if isinstance(item, str):
                yield item
            else:
                parallel_results = item

        synthesis = parallel_results.synthesis if parallel_results else {"tldr": "", "keyTakeaways": []}
        description_analysis = parallel_results.description_analysis if parallel_results else None
        first_section_result = parallel_results.first_section if parallel_results else None

        # ── Phase 3: Sections ──
        sections: list[dict[str, Any]] = []

        if video_data.has_chapters:
            async for item in process_creator_sections(llm_service, video_data, persona, first_section_result):
                if isinstance(item, str):
                    yield item
                else:
                    sections = item
        else:
            async for item in process_ai_sections(llm_service, segments, clean_text, video_data.duration, persona):
                if isinstance(item, str):
                    yield item
                else:
                    sections = item

        # ── Phase 4: Concepts ──
        concepts: list[dict[str, Any]] = []
        async for item in extract_concepts(llm_service, timestamped_transcript):
            if isinstance(item, str):
                yield item
            else:
                concepts = item

        # ── Phase 5: Master Summary ──
        master_summary: str | None = None
        async for item in generate_master_summary(
            llm_service, video_data, video_data.duration, persona, synthesis, sections, concepts
        ):
            if isinstance(item, str) and item.startswith("data:"):
                yield item
            elif item is None or isinstance(item, str):
                master_summary = item

        # ── Save Results ──
        result = build_result(ctx, synthesis, sections, concepts, master_summary, description_analysis, context_dict)
        repository.save_result(video_summary_id, result)

        processing_time = int((time.time() - start_time) * 1000)
        yield sse_event("done", {"videoSummaryId": video_summary_id, "processingTimeMs": processing_time})
        yield "data: [DONE]\n\n"

    except TranscriptError as e:
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        yield sse_event("error", {"message": str(e), "code": e.code.value})

    except Exception as e:
        import traceback
        logger.error(f"Stream error for {video_summary_id}: {e}\n{traceback.format_exc()}")
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.UNKNOWN_ERROR)
        yield sse_event("error", {"message": str(e)})


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
    2. PARALLEL (~2-5 sec): Description analysis + TLDR + first section
    3. SECTIONS: Remaining sections in batches
    4. CONCEPTS: Key concept extraction
    5. MASTER: Master summary generation
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

    for i, section in enumerate(summary.get("sections", [])):
        yield sse_event("section_ready", {"index": i, "section": section})

    yield sse_event("concepts_complete", {"concepts": summary.get("concepts", [])})

    if master_summary := summary.get("master_summary"):
        yield sse_event("master_summary_complete", {"masterSummary": master_summary})

    yield sse_event("done", {"videoSummaryId": video_summary_id, "cached": True})
    yield "data: [DONE]\n\n"
