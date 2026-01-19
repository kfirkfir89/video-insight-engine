"""SSE streaming endpoint for real-time video summarization.

This module implements progressive video summarization with:
- Instant metadata and chapters via yt-dlp
- Parallel processing of description analysis, TLDR, and first section
- Batched section processing for remaining sections
"""

import asyncio
import json
import time
import uuid
import logging
from typing import Annotated, AsyncGenerator, Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from src.config import settings
from src.dependencies import get_video_repository, get_llm_service
from src.models.schemas import ProcessingStatus, ErrorCode
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService, seconds_to_timestamp
from src.services.transcript import (
    get_transcript,
    clean_transcript,
    format_transcript_with_timestamps,
)
from src.services.youtube import extract_video_data
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

# Issue #18: Number of sections to process in parallel per batch
# Balance between parallelism and API rate limits
# Now configurable via SECTION_BATCH_SIZE environment variable
SECTION_BATCH_SIZE = settings.SECTION_BATCH_SIZE


def sse_event(event: str, data: dict[str, Any]) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps({'event': event, **data})}\n\n"


def sse_token(phase: str, token: str, **extra: Any) -> str:
    """Format token as SSE event."""
    return f"data: {json.dumps({'event': 'token', 'phase': phase, 'token': token, **extra})}\n\n"


async def stream_summarization(
    video_summary_id: str,
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
) -> AsyncGenerator[str, None]:
    """
    Generator that streams the summarization process as SSE events.

    NEW Progressive Architecture:
    1. INSTANT: yt-dlp extraction → metadata + chapters
    2. PARALLEL: description analysis + TLDR + first section (if chapters)
    3. BACKGROUND: remaining sections in batches + concepts

    Event flow:
    - metadata: Video info (instant)
    - chapters: Creator chapters (instant, if available)
    - description_analysis: Links, resources (parallel, ~1-2 sec)
    - synthesis_complete: TLDR + takeaways (parallel, ~2-3 sec)
    - section_ready: Each section as completed (progressive)
    - concepts_complete: Extracted concepts
    - done: Processing complete
    """
    start_time = time.time()

    try:
        # Get the video summary cache entry
        entry = repository.get_video_summary(video_summary_id)
        if not entry:
            yield sse_event("error", {"message": "Video summary not found"})
            return

        # Support both camelCase (from API) and snake_case (from summarizer)
        youtube_id = entry.get("youtubeId") or entry.get("youtube_id")
        if not youtube_id:
            yield sse_event("error", {"message": "YouTube ID not found"})
            return

        # Update status to processing
        repository.update_status(video_summary_id, ProcessingStatus.PROCESSING)

        # ===== PHASE 1: INSTANT - Video Data Extraction (yt-dlp) =====
        yield sse_event("phase", {"phase": "metadata"})

        video_data = await extract_video_data(youtube_id)

        yield sse_event("metadata", {
            "title": video_data.title,
            "channel": video_data.channel,
            "thumbnailUrl": video_data.thumbnail_url,
            "duration": video_data.duration,
        })

        # ===== Fetch Sponsor Segments (SponsorBlock API) =====
        sponsor_segments: list[SponsorSegment] = await get_sponsor_segments(youtube_id)
        if sponsor_segments:
            yield sse_event("sponsor_segments", {
                "segments": sponsor_segments_to_dict(sponsor_segments),
                "totalDurationRemoved": sum(
                    s.end_seconds - s.start_seconds for s in sponsor_segments
                ),
            })

        # Send chapters immediately if available (creator-defined)
        use_creator_chapters = video_data.has_chapters
        if use_creator_chapters:
            yield sse_event("chapters", {
                "chapters": [
                    {
                        "startSeconds": int(ch.start_time),
                        "endSeconds": int(ch.end_time),
                        "title": ch.title,
                    }
                    for ch in video_data.chapters
                ],
                "isCreatorChapters": True,
            })

        # ===== Validate and Get Transcript =====
        duration = video_data.duration

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

        # Use yt-dlp subtitles if available, fallback to youtube-transcript-api
        if video_data.subtitles:
            segments = [
                {"text": seg.text, "start": seg.start, "duration": seg.duration}
                for seg in video_data.subtitles
            ]
            raw_transcript = video_data.transcript_text
            transcript_type = "yt-dlp"
            logger.info(f"Using yt-dlp subtitles: {len(segments)} segments")
        else:
            logger.info("yt-dlp subtitles not available, falling back to youtube-transcript-api")
            yield sse_event("phase", {"phase": "transcript"})
            segments, raw_transcript, transcript_type = await get_transcript(youtube_id)

        yield sse_event("transcript_ready", {"duration": duration})

        # ===== Filter Sponsor Segments from Transcript =====
        if sponsor_segments:
            original_count = len(segments)
            segments = filter_transcript_segments(segments, sponsor_segments)
            # Rebuild raw transcript from filtered segments
            raw_transcript = " ".join(seg["text"] for seg in segments)
            logger.info(
                f"Filtered transcript: {original_count} -> {len(segments)} segments "
                f"(removed {original_count - len(segments)} sponsor segments)"
            )

        clean_text = clean_transcript(raw_transcript)

        # Create timestamped transcript for concept extraction
        # This allows the LLM to reference actual video timestamps
        timestamped_transcript = format_transcript_with_timestamps(segments)
        logger.debug(f"Timestamped transcript length: {len(timestamped_transcript)} chars")
        logger.debug(f"First 500 chars of timestamped transcript: {timestamped_transcript[:500]}")

        # ===== PHASE 2: PARALLEL - Description + TLDR + First Section =====
        yield sse_event("phase", {"phase": "parallel_analysis"})

        # Prepare chapter titles for TLDR
        chapter_titles = [ch.title for ch in video_data.chapters] if use_creator_chapters else []

        # Create parallel tasks
        parallel_tasks: dict[str, asyncio.Task[Any]] = {}

        # Task A: Description Analysis (Haiku, ~1-2 sec)
        parallel_tasks["description"] = asyncio.create_task(
            analyze_description(video_data.description),
            name="description"
        )

        # Task B: TLDR from metadata (Sonnet, ~2-3 sec)
        parallel_tasks["tldr"] = asyncio.create_task(
            llm_service.generate_metadata_tldr(
                video_data.title,
                video_data.description,
                chapter_titles
            ),
            name="tldr"
        )

        # Task C: First section summary (if chapters exist)
        if use_creator_chapters and len(video_data.chapters) > 0:
            first_chapter = video_data.chapters[0]
            first_section_text = video_data.get_chapter_transcript(0)
            if first_section_text:
                parallel_tasks["first_section"] = asyncio.create_task(
                    llm_service.summarize_section(
                        first_section_text,
                        first_chapter.title,
                        has_creator_title=True,
                    ),
                    name="first_section"
                )

        # Run parallel tasks with asyncio.gather for reliable error tracking
        # return_exceptions=True ensures all tasks complete and exceptions are returned as values
        description_analysis: DescriptionAnalysis | None = None
        synthesis: dict[str, Any] = {"tldr": "", "keyTakeaways": []}
        first_section_result: dict[str, Any] | None = None
        failed_parallel_tasks: list[str] = []

        # Get task names and tasks in consistent order
        task_names = list(parallel_tasks.keys())
        tasks = list(parallel_tasks.values())

        # Gather all results (exceptions returned as values, not raised)
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results in order, matching each result to its task name
        for task_name, result in zip(task_names, results):
            if isinstance(result, BaseException):
                # Task failed - log and track
                failed_parallel_tasks.append(task_name)
                logger.error(f"Parallel task '{task_name}' failed: {result}")
                continue

            # Process successful result based on task name
            if task_name == "description" and isinstance(result, DescriptionAnalysis):
                description_analysis = result
                if result.has_content:
                    yield sse_event("description_analysis", result.to_dict())
            elif task_name == "tldr" and isinstance(result, dict):
                synthesis = result
                yield sse_event("synthesis_complete", {
                    "tldr": synthesis.get("tldr", ""),
                    "keyTakeaways": synthesis.get("keyTakeaways", []),
                })
            elif task_name == "first_section" and isinstance(result, dict):
                first_section_result = result

        # Emit warning if some parallel tasks failed
        if failed_parallel_tasks:
            yield sse_event("warning", {
                "message": f"Some analyses failed: {', '.join(failed_parallel_tasks)}",
                "failedTasks": failed_parallel_tasks,
            })

        # ===== PHASE 3: Section Processing =====
        yield sse_event("phase", {"phase": "section_summaries"})

        sections: list[dict[str, Any]] = []

        if use_creator_chapters:
            # Use creator chapters as sections
            raw_sections = [
                {
                    "title": ch.title,
                    "startSeconds": int(ch.start_time),
                    "endSeconds": int(ch.end_time),
                }
                for ch in video_data.chapters
            ]

            # Add first section if we already processed it
            if first_section_result:
                first_ch = video_data.chapters[0]
                section = {
                    "id": str(uuid.uuid4()),
                    "timestamp": seconds_to_timestamp(int(first_ch.start_time)),
                    "start_seconds": int(first_ch.start_time),
                    "end_seconds": int(first_ch.end_time),
                    "title": first_ch.title,
                    "original_title": first_ch.title,
                    "generated_title": first_section_result.get("generatedTitle"),
                    "is_creator_chapter": True,
                    "content": first_section_result.get("content", []),
                    "summary": first_section_result.get("summary", ""),
                    "bullets": first_section_result.get("bullets", []),
                }
                sections.append(section)
                yield sse_event("section_ready", {"index": 0, "section": section})

            # Process remaining sections in batches
            remaining_indices = list(range(1 if first_section_result else 0, len(raw_sections)))

            for batch_start in range(0, len(remaining_indices), SECTION_BATCH_SIZE):
                batch_indices = remaining_indices[batch_start:batch_start + SECTION_BATCH_SIZE]

                # Create batch tasks
                batch_tasks = []
                for idx in batch_indices:
                    raw = raw_sections[idx]
                    section_text = video_data.get_chapter_transcript(idx)
                    if section_text:
                        batch_tasks.append((idx, raw, asyncio.create_task(
                            llm_service.summarize_section(
                                section_text,
                                raw["title"],
                                has_creator_title=True,
                            )
                        )))

                # Wait for batch to complete
                for idx, raw, task in batch_tasks:
                    try:
                        summary_data = await task
                        section = {
                            "id": str(uuid.uuid4()),
                            "timestamp": seconds_to_timestamp(raw["startSeconds"]),
                            "start_seconds": raw["startSeconds"],
                            "end_seconds": raw["endSeconds"],
                            "title": raw["title"],
                            "original_title": raw["title"],
                            "generated_title": summary_data.get("generatedTitle"),
                            "is_creator_chapter": True,
                            "content": summary_data.get("content", []),
                            "summary": summary_data.get("summary", ""),
                            "bullets": summary_data.get("bullets", []),
                        }
                        sections.append(section)
                        yield sse_event("section_ready", {"index": idx, "section": section})
                    except Exception as e:
                        logger.error(f"Section {idx} processing error: {e}")

        else:
            # Fallback: AI section detection (slower path)
            yield sse_event("phase", {"phase": "section_detect"})

            raw_sections = []
            async for event_type, data in llm_service.stream_detect_sections(clean_text, segments, duration):
                if event_type == "token":
                    yield sse_token("section_detect", str(data))
                else:
                    raw_sections = data if isinstance(data, list) else []

            # Clamp timestamps
            for section in raw_sections:
                section["startSeconds"] = max(0, min(section.get("startSeconds", 0), duration))
                section["endSeconds"] = max(0, min(section.get("endSeconds", duration), duration))

            yield sse_event("sections_detected", {
                "count": len(raw_sections),
                "sections": [{"title": s.get("title"), "startSeconds": s.get("startSeconds")} for s in raw_sections]
            })

            yield sse_event("phase", {"phase": "section_summaries"})

            # Process sections in batches
            for batch_start in range(0, len(raw_sections), SECTION_BATCH_SIZE):
                batch = raw_sections[batch_start:batch_start + SECTION_BATCH_SIZE]
                batch_tasks = []

                for i, raw in enumerate(batch):
                    idx = batch_start + i
                    start = raw.get("startSeconds", 0)
                    end = raw.get("endSeconds", start + 300)
                    section_segments = [s for s in segments if start <= s["start"] <= end]
                    section_text = " ".join([s["text"] for s in section_segments])

                    batch_tasks.append((idx, raw, start, end, asyncio.create_task(
                        llm_service.summarize_section(section_text, raw["title"])
                    )))

                for idx, raw, start, end, task in batch_tasks:
                    try:
                        summary_data = await task
                        section = {
                            "id": str(uuid.uuid4()),
                            "timestamp": seconds_to_timestamp(start),
                            "start_seconds": start,
                            "end_seconds": end,
                            "title": raw["title"],
                            "is_creator_chapter": False,
                            "content": summary_data.get("content", []),
                            "summary": summary_data.get("summary", ""),
                            "bullets": summary_data.get("bullets", []),
                        }
                        sections.append(section)
                        yield sse_event("section_ready", {"index": idx, "section": section})
                    except Exception as e:
                        logger.error(f"Section {idx} processing error: {e}")

        # ===== PHASE 4: Concepts =====
        yield sse_event("phase", {"phase": "concepts"})

        raw_concepts: list[dict[str, Any]] = []
        # Use timestamped transcript so LLM can reference actual video timestamps
        async for event_type, data in llm_service.stream_extract_concepts(timestamped_transcript):
            if event_type == "token":
                yield sse_token("concepts", str(data))
            else:
                raw_concepts = data if isinstance(data, list) else []

        # Debug logging for concept extraction (verbose - use debug level)
        logger.debug(f"Extracted {len(raw_concepts)} concepts: {[c.get('name') for c in raw_concepts]}")
        logger.debug(f"Concept timestamps: {[c.get('timestamp') for c in raw_concepts]}")

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

        # ===== SAVE RESULTS =====
        processing_time = int((time.time() - start_time) * 1000)

        result: dict[str, Any] = {
            "title": video_data.title,
            "channel": video_data.channel,
            "duration": duration,
            "thumbnail_url": video_data.thumbnail_url,
            "transcript": raw_transcript,
            "transcript_type": transcript_type,
            "summary": {
                "tldr": synthesis.get("tldr", ""),
                "key_takeaways": synthesis.get("keyTakeaways", []),
                "sections": sections,
                "concepts": concepts,
            },
            "processing_time_ms": processing_time,
            "token_usage": {},
        }

        # Add chapters if available
        if use_creator_chapters:
            result["chapters"] = [
                {
                    "startSeconds": int(ch.start_time),
                    "endSeconds": int(ch.end_time),
                    "title": ch.title,
                    "isCreatorChapter": True,
                }
                for ch in video_data.chapters
            ]
            result["chapter_source"] = "creator"

        # Add description analysis if available
        if description_analysis and description_analysis.has_content:
            result["description_analysis"] = description_analysis.to_dict()

        # Add sponsor segments if detected
        if sponsor_segments:
            result["sponsor_segments"] = sponsor_segments_to_dict(sponsor_segments)

        repository.save_result(video_summary_id, result)

        yield sse_event("done", {
            "videoSummaryId": video_summary_id,
            "processingTimeMs": processing_time,
        })
        yield "data: [DONE]\n\n"

    except TranscriptError as e:
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        yield sse_event("error", {"message": str(e), "code": e.code.value})

    except Exception as e:
        import traceback
        logger.error(f"Stream error for {video_summary_id}: {e}\n{traceback.format_exc()}")
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.UNKNOWN_ERROR)
        yield sse_event("error", {"message": str(e)})


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
    3. BACKGROUND: Remaining sections + concepts

    Event types:
    - phase: Start of a new processing phase
    - metadata: Video info (title, channel, thumbnail, duration)
    - chapters: Creator-defined chapters (if available)
    - description_analysis: Links, resources, related videos
    - synthesis_complete: TLDR and key takeaways
    - section_ready: Individual section (index + content)
    - concepts_complete: All concepts extracted
    - done: Processing complete
    - error: Error occurred
    """
    # Validate ObjectId format
    try:
        ObjectId(video_summary_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid video summary ID format")

    entry = repository.get_video_summary(video_summary_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Video summary not found")

    # Check if already completed - return cached result via SSE
    if entry.get("status") == ProcessingStatus.COMPLETED.value:
        async def cached_response() -> AsyncGenerator[str, None]:
            yield sse_event("cached", {"videoSummaryId": video_summary_id})
            yield sse_event("metadata", {
                "title": entry.get("title"),
                "channel": entry.get("channel"),
                "thumbnailUrl": entry.get("thumbnail_url"),
                "duration": entry.get("duration"),
            })

            # Send chapters if available
            chapters = entry.get("chapters")
            if chapters:
                yield sse_event("chapters", {
                    "chapters": chapters,
                    "isCreatorChapters": entry.get("chapter_source") == "creator",
                })

            # Send description analysis if available
            desc_analysis = entry.get("description_analysis")
            if desc_analysis:
                yield sse_event("description_analysis", desc_analysis)

            summary = entry.get("summary", {})
            yield sse_event("synthesis_complete", {
                "tldr": summary.get("tldr", ""),
                "keyTakeaways": summary.get("key_takeaways", []),
            })

            for i, section in enumerate(summary.get("sections", [])):
                yield sse_event("section_ready", {"index": i, "section": section})

            yield sse_event("concepts_complete", {"concepts": summary.get("concepts", [])})
            yield sse_event("done", {
                "videoSummaryId": video_summary_id,
                "cached": True,
            })
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            cached_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Stream the summarization process
    return StreamingResponse(
        stream_summarization(video_summary_id, repository, llm_service),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
