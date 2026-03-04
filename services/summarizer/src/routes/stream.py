"""SSE streaming endpoint for real-time video summarization.

This module implements progressive video summarization with:
- Instant metadata and chapters via yt-dlp
- Parallel processing of description analysis, TLDR, and first section
- Batched section processing for remaining sections

Architecture follows Single Responsibility Principle:
- Each phase has its own handler function
- Main generator orchestrates phases and yields SSE events

Helper functions (SSE formatting, data classes, result building, etc.)
live in src.services.pipeline_helpers to keep this module focused on
route handlers and streaming generators.

Transcript fetching lives in src.services.transcript_fetcher.
Concept extraction & master summary live in src.services.summary_generators.
"""

import asyncio
import logging
import uuid
from typing import Annotated, Any, AsyncGenerator

from pydantic import BaseModel

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from llm_common.context import llm_video_id_var, llm_feature_var
import litellm

from src.config import settings
from src.dependencies import get_video_repository, get_llm_service, create_llm_provider
from src.models.schemas import ProcessingStatus, ErrorCode, ProviderConfig
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService, ChapterSummaryRequest, ChapterContext, AccuracyHints, merge_chapter_concepts, title_needs_subtitle
from src.services.accuracy import extract_chapter_facts
from src.services.chapter_pipeline import (
    ChapterTimeRange,
    CrossChapterState,
    gather_chapter_facts,
    postprocess_chapter,
    build_chapter_dict,
)
from src.services.transcript import clean_transcript
from src.utils.transcript_slicer import slice_transcript_for_chapter
from src.services.youtube import (
    extract_video_data,
    VideoData,
    SubtitleSegment,
)
from src.services.description_analyzer import analyze_description, DescriptionAnalysis
from src.services.sponsorblock import (
    get_sponsor_segments,
    filter_transcript_segments,
    sponsor_segments_to_dict,
)
from src.exceptions import TranscriptError
from src.services.stream_url import clear_stream_url_cache  # noqa: F401 — used in tests
from src.services.transcript_store import transcript_store
from src.services.s3_client import s3_client
from src.services.transcript_fetcher import fetch_transcript
from src.services.summary_generators import extract_concepts, generate_master_summary
from src.services.override_state import clear_override, mark_generation_started, is_generation_started, clear_generation_started
from src.services.pipeline_helpers import (
    apply_override,
    sse_event,
    sse_token,
    PipelineTimer,
    TranscriptData,
    ParallelResults,
    PipelineContext,
    ChapterProcessingContext,
    PostprocessContext,
    normalize_segments,
    validate_duration,
    finalize_video_context,
    extract_context,
    has_empty_content as _has_empty_content,
    collect_chapter_concepts as _collect_chapter_concepts,
    build_result,
    refresh_frame_urls as _refresh_frame_urls,
)

logger = logging.getLogger(__name__)


router = APIRouter()

# Configurable batch size for parallel chapter processing
CHAPTER_BATCH_SIZE = settings.CHAPTER_BATCH_SIZE


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: Parallel Analysis
# ─────────────────────────────────────────────────────────────────────────────


async def run_parallel_analysis(
    llm_service: LLMService,
    video_data: VideoData,
    persona: str,
    output_type: str = "summary",
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
    # Also runs fact extraction in parallel for accuracy pipeline
    # Minimum text length for fact extraction (avoids wasting LLM calls on tiny chapters)
    _MIN_FACT_TEXT_LENGTH = 100

    if video_data.has_chapters and len(video_data.chapters) > 0:
        first_chapter_text = video_data.get_chapter_transcript(0)
        if first_chapter_text:
            first_ch = video_data.chapters[0]
            # Fact extraction runs in parallel — skip for very short chapters
            if len(first_chapter_text) >= _MIN_FACT_TEXT_LENGTH:
                tasks["first_facts"] = asyncio.create_task(
                    extract_chapter_facts(
                        llm_service.provider,
                        first_chapter_text,
                        first_ch.title,
                        persona=persona,
                    ),
                    name="first_facts"
                )
            tasks["first_chapter"] = asyncio.create_task(
                llm_service.summarize_chapter(ChapterSummaryRequest(
                    chapter_text=first_chapter_text,
                    context=ChapterContext(
                        title=first_ch.title,
                        has_creator_title=title_needs_subtitle(first_ch.title),
                        persona=persona,
                        output_type=output_type,
                        persona_hint=persona,
                        start_seconds=int(first_ch.start_time),
                        end_seconds=int(first_ch.end_time),
                    ),
                    extract_concepts=True,
                    total_chapters=total_chapters,
                    already_extracted_names=None,
                )),
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
            logger.error("Parallel task '%s' failed: %s", task_name, result)
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

        elif task_name == "first_facts":
            if isinstance(result, str):
                parallel_results.first_facts = result

        elif task_name == "first_chapter" and isinstance(result, dict):
            parallel_results.first_chapter = result

    # Note: first chapter validation is handled by postprocess_chapter() in
    # process_creator_chapters/process_ai_chapters with the actual first_facts.

    if parallel_results.failed_tasks:
        yield sse_event("warning", {
            "message": f"Some analyses failed: {', '.join(parallel_results.failed_tasks)}",
            "failedTasks": parallel_results.failed_tasks,
        })

    yield parallel_results


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: Section Processing
# ─────────────────────────────────────────────────────────────────────────────

# Cross-chapter state, validation, and chapter building are in
# src.services.chapter_pipeline (extracted for maintainability).


async def _postprocess_and_yield_chapters(
    items: list[tuple[int, dict[str, Any], dict[str, Any]]],
    pp_ctx: PostprocessContext,
    chapters_result: list[dict[str, Any]],
) -> AsyncGenerator[str, None]:
    """Shared Phase B+C: postprocess chapters in parallel, then yield SSE events in order.

    Args:
        items: List of (idx, raw_chapter_dict, summary_data) from Phase A.
        pp_ctx: Bundled postprocessing parameters.
        chapters_result: Mutated in-place — completed chapters are appended.

    Yields:
        SSE event strings for each completed chapter.
    """
    # Phase B: Start all postprocessing in parallel (frame extraction is the slow part)
    pp_tasks: list[tuple[int, dict[str, Any], dict[str, Any], asyncio.Task[Any]]] = []
    for idx, raw, summary_data in items:
        pp_task = asyncio.create_task(postprocess_chapter(
            summary_data=summary_data,
            state=pp_ctx.state,
            provider=pp_ctx.provider,
            facts=pp_ctx.facts_by_idx.get(idx, ""),
            title=raw.get("title", ""),
            youtube_id=pp_ctx.youtube_id,
            idx=idx,
            time_range=ChapterTimeRange(
                video_duration=pp_ctx.video_duration,
                chapter_start=raw["startSeconds"],
                chapter_end=raw["endSeconds"],
            ),
        ))
        pp_tasks.append((idx, raw, summary_data, pp_task))

    # Phase C: Await postprocessing results in order and yield SSE events
    for idx, raw, summary_data, pp_task in pp_tasks:
        try:
            summary_data["content"] = await pp_task
        except Exception as e:
            logger.error("Chapter %d postprocess error: %s", idx, e)
            yield sse_event("chapter_error", {"index": idx, "error": str(e)})
            # Fallback: summary_data["content"] retains the raw LLM content blocks
            # (no frame enrichment) rather than silently dropping a chapter.

        transcript_slice = slice_transcript_for_chapter(
            pp_ctx.normalized_segments, raw["startSeconds"], raw["endSeconds"],
        )
        chapter = build_chapter_dict(
            raw, summary_data,
            is_creator_chapter=pp_ctx.is_creator,
            transcript_slice=transcript_slice,
            youtube_id=pp_ctx.youtube_id,
        )
        chapters_result.append(chapter)
        yield sse_event("chapter_ready", {"index": idx, "chapter": chapter})


async def process_creator_chapters(
    ctx: ChapterProcessingContext,
    video_data: VideoData,
    first_chapter_result: dict[str, Any] | None,
    first_facts: str = "",
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

    state = CrossChapterState()

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

        # Post-process: track cross-chapter state, fire validation, extract frames
        first_chapter_result["content"] = await postprocess_chapter(
            summary_data=first_chapter_result,
            state=state,
            provider=ctx.llm_service.provider,
            facts=first_facts,
            title=first_ch.title,
            youtube_id=ctx.youtube_id,
            idx=0,
            time_range=ChapterTimeRange(
                video_duration=video_data.duration,
                chapter_start=int(first_ch.start_time),
                chapter_end=int(first_ch.end_time),
            ),
        )

        transcript_slice = slice_transcript_for_chapter(
            ctx.normalized_segments, int(first_ch.start_time), int(first_ch.end_time)
        )
        chapter = build_chapter_dict(
            {"title": first_ch.title, "startSeconds": int(first_ch.start_time), "endSeconds": int(first_ch.end_time)},
            first_chapter_result,
            is_creator_chapter=True,
            transcript_slice=transcript_slice,
            youtube_id=ctx.youtube_id,
        )
        chapters_result.append(chapter)
        # Mark generation started on first chapter_ready — overrides rejected after this point
        if ctx.video_summary_id:
            mark_generation_started(ctx.video_summary_id)
        yield sse_event("chapter_ready", {"index": 0, "chapter": chapter})
    elif first_chapter_result:
        logger.warning("Dropping chapter 0 '%s' — empty content", video_chapters[0].title)

    # Process remaining chapters in batches
    start_idx = 1 if first_chapter_result else 0
    remaining_indices = list(range(start_idx, len(raw_chapters)))

    for batch_start in range(0, len(remaining_indices), CHAPTER_BATCH_SIZE):
        batch_indices = remaining_indices[batch_start:batch_start + CHAPTER_BATCH_SIZE]
        batch_tasks: list[tuple[int, dict[str, Any], asyncio.Task[Any]]] = []

        effective_persona, effective_output_type = apply_override(ctx)

        # Snapshot: all tasks in a batch see the same already-extracted list.
        # Intra-batch duplicates are expected and handled by merge_chapter_concepts().
        batch_already_extracted = list(already_extracted_names)

        # Extract facts for batch chapters in parallel
        facts_by_idx = await gather_chapter_facts(
            ctx.llm_service.provider,
            [(idx, video_data.get_chapter_transcript(idx) or "", raw_chapters[idx]["title"])
             for idx in batch_indices],
            effective_persona,
        )

        for idx in batch_indices:
            raw = raw_chapters[idx]
            chapter_text = video_data.get_chapter_transcript(idx)
            if chapter_text:
                task = asyncio.create_task(
                    ctx.llm_service.summarize_chapter(ChapterSummaryRequest(
                        chapter_text=chapter_text,
                        context=ChapterContext(
                            title=raw["title"],
                            has_creator_title=title_needs_subtitle(raw["title"]),
                            persona=effective_persona,
                            output_type=effective_output_type,
                            persona_hint=effective_persona,
                            start_seconds=raw["startSeconds"],
                            end_seconds=raw["endSeconds"],
                        ),
                        concept_names=batch_already_extracted or None,
                        extract_concepts=True,
                        total_chapters=total_chapters,
                        already_extracted_names=batch_already_extracted,
                        accuracy=AccuracyHints(
                            facts=facts_by_idx.get(idx, ""),
                            guest_names=state.guest_names,
                            prev_chapter_block_types=state.prev_block_types,
                        ),
                    ))
                )
                batch_tasks.append((idx, raw, task))

        # Phase A: Await all LLM results (already running in parallel)
        batch_results: list[tuple[int, dict[str, Any], dict[str, Any]]] = []
        for idx, raw, task in batch_tasks:
            try:
                summary_data = await task
                _collect_chapter_concepts(
                    summary_data, idx, all_chapter_concepts, already_extracted_names,
                )
                if _has_empty_content(summary_data, idx, raw.get("title", "")):
                    continue
                batch_results.append((idx, raw, summary_data))
            except Exception as e:
                logger.error("Chapter %d processing error: %s", idx, e)

        # Phase B+C: postprocess in parallel and yield SSE events
        pp_ctx = PostprocessContext(
            state=state,
            provider=ctx.llm_service.provider,
            facts_by_idx=facts_by_idx,
            youtube_id=ctx.youtube_id,
            video_duration=video_data.duration,
            normalized_segments=ctx.normalized_segments,
            is_creator=True,
        )
        async for event in _postprocess_and_yield_chapters(
            batch_results, pp_ctx, chapters_result,
        ):
            # Mark generation started on first chapter_ready from batch processing
            # (covers the case where first creator chapter was dropped/empty)
            if ctx.video_summary_id and not is_generation_started(ctx.video_summary_id):
                mark_generation_started(ctx.video_summary_id)
            yield event

    # Merge all chapter concepts with fuzzy dedup
    concepts = merge_chapter_concepts(all_chapter_concepts)
    logger.info("Per-chapter concept extraction: %d raw → %d merged", sum(len(c) for _, c in all_chapter_concepts), len(concepts))

    yield {"chapters": chapters_result, "concepts": concepts}


async def process_ai_chapters(
    ctx: ChapterProcessingContext,
    segments: list[dict[str, Any]],
    clean_text: str,
    duration: int,
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
    async for event_type, data in ctx.llm_service.stream_detect_chapters(clean_text, segments, duration):
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

    state = CrossChapterState()

    for batch_start in range(0, len(raw_chapters), CHAPTER_BATCH_SIZE):
        batch = raw_chapters[batch_start:batch_start + CHAPTER_BATCH_SIZE]
        batch_tasks: list[tuple[int, dict[str, Any], int, int, asyncio.Task[Any]]] = []

        effective_persona, effective_output_type = apply_override(ctx)

        # Snapshot for this batch
        batch_already_extracted = list(already_extracted_names)

        # Build chapter texts from segments for this batch
        chapter_texts: dict[int, str] = {}
        for i, raw in enumerate(batch):
            idx = batch_start + i
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", 0) or (start + 300)
            chapter_segments = [s for s in segments if start <= s.get("start", 0) < end]
            chapter_texts[idx] = " ".join([s.get("text", "") for s in chapter_segments])

        # Extract facts for batch chapters in parallel
        facts_by_idx = await gather_chapter_facts(
            ctx.llm_service.provider,
            [(batch_start + i, chapter_texts.get(batch_start + i, ""), raw.get("title", ""))
             for i, raw in enumerate(batch)],
            effective_persona,
        )

        for i, raw in enumerate(batch):
            idx = batch_start + i
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", 0) or (start + 300)
            chapter_text = chapter_texts.get(idx, "")

            task = asyncio.create_task(
                ctx.llm_service.summarize_chapter(ChapterSummaryRequest(
                    chapter_text=chapter_text,
                    context=ChapterContext(
                        title=raw.get("title", ""),
                        persona=effective_persona,
                        output_type=effective_output_type,
                        persona_hint=effective_persona,
                        start_seconds=start,
                        end_seconds=end,
                    ),
                    concept_names=batch_already_extracted or None,
                    extract_concepts=True,
                    total_chapters=total_chapters,
                    already_extracted_names=batch_already_extracted,
                    accuracy=AccuracyHints(
                        facts=facts_by_idx.get(idx, ""),
                        guest_names=state.guest_names,
                        prev_chapter_block_types=state.prev_block_types,
                    ),
                ))
            )
            batch_tasks.append((idx, raw, start, end, task))

        # Phase A: Await all LLM results (already running in parallel)
        batch_results: list[tuple[int, dict[str, Any], dict[str, Any]]] = []
        for idx, raw, start, end, task in batch_tasks:
            try:
                summary_data = await task
                _collect_chapter_concepts(
                    summary_data, idx, all_chapter_concepts, already_extracted_names,
                )
                if _has_empty_content(summary_data, idx, raw.get("title", "")):
                    continue
                # Normalize raw dict with resolved start/end for the shared helper
                normalized_raw = {"title": raw.get("title", ""), "startSeconds": start, "endSeconds": end}
                batch_results.append((idx, normalized_raw, summary_data))
            except Exception as e:
                logger.error("Chapter %d processing error: %s", idx, e)

        # Phase B+C: postprocess in parallel and yield SSE events
        pp_ctx = PostprocessContext(
            state=state,
            provider=ctx.llm_service.provider,
            facts_by_idx=facts_by_idx,
            youtube_id=ctx.youtube_id,
            video_duration=duration,
            normalized_segments=ctx.normalized_segments,
            is_creator=False,
        )
        async for event in _postprocess_and_yield_chapters(
            batch_results, pp_ctx, chapters_result,
        ):
            # Mark generation started on first chapter_ready — overrides rejected after this point
            if ctx.video_summary_id and not is_generation_started(ctx.video_summary_id):
                mark_generation_started(ctx.video_summary_id)
            yield event

    # Merge all chapter concepts with fuzzy dedup
    concepts = merge_chapter_concepts(all_chapter_concepts)
    logger.info("Per-chapter concept extraction: %d raw → %d merged", sum(len(c) for _, c in all_chapter_concepts), len(concepts))

    yield {"chapters": chapters_result, "concepts": concepts}


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
    timer = PipelineTimer()
    # Stream URL cache has TTL-based eviction (5 min); no need to clear per-request

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

        # Set video context for LLM usage tracking (feature updated per-phase below).
        # Note: asyncio.create_task() copies ContextVars at task creation time, so
        # postprocess tasks inherit the feature var value set before they're created.
        llm_video_id_var.set(youtube_id)

        repository.update_status(video_summary_id, ProcessingStatus.PROCESSING)
        logger.info("[pipeline] START video_id=%s youtube_id=%s", video_summary_id, youtube_id)

        # ── Phase 1: Metadata ──
        llm_feature_var.set("summarize:metadata")
        yield sse_event("phase", {"phase": "metadata"})
        video_data = await extract_video_data(youtube_id)

        # Finalize context with LLM fallback if confidence is low
        video_data = await finalize_video_context(video_data, llm_service.provider)
        context_dict, persona, output_type = extract_context(video_data)

        yield sse_event("metadata", {
            "title": video_data.title,
            "channel": video_data.channel,
            "thumbnailUrl": video_data.thumbnail_url,
            "duration": video_data.duration,
            "context": context_dict,
        })

        # Emit detection result so frontend can show detected type and offer override
        confidence = (video_data.context.category_confidence or 0.0) if video_data.context else 0.0
        yield sse_event("detection_result", {
            "category": (context_dict or {}).get("category", "standard"),
            "outputType": output_type,
            "confidence": confidence,
        })

        # Sponsor segments
        sponsor_segments = await get_sponsor_segments(youtube_id)
        if sponsor_segments:
            yield sse_event("sponsor_segments", {
                "segments": sponsor_segments_to_dict(sponsor_segments),
                "totalDurationRemoved": sum(s.end_seconds - s.start_seconds for s in sponsor_segments),
            })

        logger.debug("Processing chapters: has_chapters=%s", video_data.has_chapters)

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
        logger.debug("Validating duration: %s seconds (%d min)", video_data.duration, video_data.duration // 60)
        validate_duration(video_data.duration)
        logger.debug("Duration validation passed")
        phase_elapsed = timer.elapsed()
        category = (context_dict or {}).get("category", "unknown")
        duration_min = video_data.duration // 60
        duration_sec = video_data.duration % 60
        logger.info(
            "[pipeline] metadata: \"%s\" (%d:%02d, category=%s) [%.1fs]",
            video_data.title, duration_min, duration_sec, category, phase_elapsed,
        )

        # ── Fetch Transcript ──
        transcript_data: TranscriptData | None = None
        is_music = (context_dict or {}).get("category") == "music"

        async for item in fetch_transcript(youtube_id, video_data, video_data.duration, is_music=is_music):
            if isinstance(item, str):
                yield item  # SSE event
            else:
                transcript_data = item

        if not transcript_data:
            raise TranscriptError("Failed to fetch transcript", ErrorCode.NO_TRANSCRIPT)

        yield sse_event("transcript_ready", {"duration": video_data.duration})

        is_metadata_source = transcript_data.source == "metadata"

        # Normalize segments for consistent handling
        normalized_segments = normalize_segments(transcript_data.segments) if not is_metadata_source else []

        # Store raw transcript in S3 BEFORE sponsor filtering
        # Skip for metadata fallback (no real transcript to store)
        raw_transcript_ref: str | None = None
        if is_metadata_source:
            logger.debug("Metadata fallback — skipping S3 storage and sponsor filtering")
        elif transcript_data.source == "s3":
            raw_transcript_ref = f"videos/{youtube_id}/transcript.json"
            logger.debug("Transcript loaded from S3, skipping re-store")
        else:
            try:
                raw_transcript_ref = await transcript_store.store(
                    youtube_id=youtube_id,
                    segments=normalized_segments,
                    source=transcript_data.source,  # type: ignore[arg-type]
                    language=None,  # TODO: detect language from yt-dlp
                )
                logger.debug("Stored transcript in S3: %s", raw_transcript_ref)
            except Exception as e:
                logger.warning("Failed to store transcript in S3: %s", e)

        # Filter sponsor content (skip for metadata fallback — no segments)
        segments = transcript_data.segments
        if sponsor_segments and not is_metadata_source:
            original_count = len(segments)
            segments = filter_transcript_segments(segments, sponsor_segments)
            transcript_data.segments = segments
            transcript_data.raw_text = " ".join(seg.get("text", "") for seg in segments)
            # Re-normalize after filtering
            normalized_segments = normalize_segments(segments)
            logger.debug("Filtered transcript: %d -> %d segments", original_count, len(segments))

        # Backfill video_data.subtitles from transcript segments when yt-dlp
        # subtitles were unavailable (e.g. S3 cache, Whisper, Gemini fallback).
        # Without this, get_chapter_transcript() returns empty strings and
        # all creator-defined chapters are silently skipped.
        if not video_data.subtitles and transcript_data.segments:
            video_data.subtitles = [
                SubtitleSegment(
                    text=seg.get("text", ""),
                    start=seg.get("start", 0.0),
                    duration=seg.get("duration", 0.0),
                )
                for seg in transcript_data.segments
            ]
            logger.info(
                "Backfilled video_data.subtitles from %s: %d segments",
                transcript_data.source, len(video_data.subtitles),
            )

        clean_text = clean_transcript(transcript_data.raw_text)
        transcript_elapsed = timer.elapsed()
        logger.info(
            "[pipeline] transcript: source=%s, segments=%d [%.1fs]",
            transcript_data.source, len(transcript_data.segments), transcript_elapsed,
        )

        # Build pipeline context
        ctx = PipelineContext(
            video_summary_id=video_summary_id,
            youtube_id=youtube_id,
            video_data=video_data,
            transcript=transcript_data,
            persona=persona,
            sponsor_segments=sponsor_segments,
            timer=timer,
            output_type=output_type,
            raw_transcript_ref=raw_transcript_ref,
        )

        # ── Phase 2: Parallel Analysis (TLDR + first chapter with concepts) ──
        llm_feature_var.set("summarize:analysis")
        parallel_results: ParallelResults | None = None
        async for item in run_parallel_analysis(
            llm_service, video_data, persona, output_type,
        ):
            if isinstance(item, str):
                yield item
            else:
                parallel_results = item

        synthesis = parallel_results.synthesis if parallel_results else {"tldr": "", "keyTakeaways": []}
        description_analysis = parallel_results.description_analysis if parallel_results else None
        first_chapter_result = parallel_results.first_chapter if parallel_results else None
        parallel_elapsed = timer.elapsed()
        tldr_status = "ok" if synthesis.get("tldr") else "empty"
        desc_status = "ok" if description_analysis else "skip"
        ch1_status = "ok" if first_chapter_result else "skip"
        logger.info(
            "[pipeline] parallel: tldr=%s, desc=%s, ch1=%s [%.1fs]",
            tldr_status, desc_status, ch1_status, parallel_elapsed,
        )

        # ── Phase 3: Chapters with per-chapter concept extraction ──
        llm_feature_var.set("summarize:chapter")
        chapters: list[dict[str, Any]] = []
        concepts: list[dict[str, Any]] = []

        chapter_ctx = ChapterProcessingContext(
            llm_service=llm_service,
            persona=persona,
            normalized_segments=normalized_segments,
            youtube_id=youtube_id,
            output_type=output_type,
            video_summary_id=video_summary_id,
        )

        if video_data.has_chapters:
            first_facts = parallel_results.first_facts if parallel_results else ""
            async for item in process_creator_chapters(
                chapter_ctx, video_data, first_chapter_result,
                first_facts=first_facts,
            ):
                if isinstance(item, str):
                    yield item
                elif isinstance(item, dict):
                    chapters = item.get("chapters", [])
                    concepts = item.get("concepts", [])
        else:
            async for item in process_ai_chapters(
                chapter_ctx, segments, clean_text, video_data.duration,
            ):
                if isinstance(item, str):
                    yield item
                elif isinstance(item, dict):
                    chapters = item.get("chapters", [])
                    concepts = item.get("concepts", [])

        chapters_elapsed = timer.elapsed()
        chapter_type = "creator" if video_data.has_chapters else "ai"
        logger.info(
            "[pipeline] chapters: %d/%d complete (%s) [%.1fs]",
            len(chapters), len(chapters), chapter_type, chapters_elapsed,
        )

        # Emit concepts after all chapters processed
        if concepts:
            yield sse_event("concepts_complete", {"concepts": concepts})

        # ── Phase 4: Master Summary ──
        llm_feature_var.set("summarize:master")
        master_summary: str | None = None
        async for item in generate_master_summary(
            llm_service, video_data, video_data.duration, persona, synthesis, chapters, concepts
        ):
            if isinstance(item, str) and item.startswith("data:"):
                yield item
            elif item is None or isinstance(item, str):
                master_summary = item

        master_elapsed = timer.elapsed()
        logger.info(
            "[pipeline] master_summary: %d chars [%.1fs]",
            len(master_summary) if master_summary else 0, master_elapsed,
        )

        # ── Save Results ──
        result = build_result(
            ctx, synthesis, chapters, concepts, master_summary,
            description_analysis, context_dict, llm_service.provider.model
        )
        repository.save_result(video_summary_id, result)

        processing_time = int(timer.elapsed() * 1000)
        logger.info("[pipeline] DONE video_id=%s total=%.1fs", video_summary_id, processing_time / 1000)
        yield sse_event("done", {"videoSummaryId": video_summary_id, "processingTimeMs": processing_time})
        yield "data: [DONE]\n\n"

    except TranscriptError as e:
        logger.info("[pipeline] FAILED video_id=%s error=TranscriptError total=%.1fs", video_summary_id, timer.elapsed())
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        yield sse_event("error", {"message": str(e), "code": e.code.value})

    except litellm.RateLimitError as e:
        logger.info("[pipeline] FAILED video_id=%s error=RateLimitError total=%.1fs", video_summary_id, timer.elapsed())
        logger.warning("Rate limited for %s: %s", video_summary_id, e)
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.RATE_LIMITED)
        yield sse_event("error", {"message": "AI service rate limited. Please try again in a moment.", "code": ErrorCode.RATE_LIMITED.value})

    except litellm.Timeout as e:
        logger.info("[pipeline] FAILED video_id=%s error=Timeout total=%.1fs", video_summary_id, timer.elapsed())
        logger.warning("LLM timeout for %s: %s", video_summary_id, e)
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "Request took too long. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except litellm.APIError as e:
        logger.info("[pipeline] FAILED video_id=%s error=APIError total=%.1fs", video_summary_id, timer.elapsed())
        logger.error("LLM API error for %s: %s", video_summary_id, e)
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "AI service error. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except Exception as e:
        error_ref = str(uuid.uuid4())[:8]
        logger.info("[pipeline] FAILED video_id=%s error=%s ref=%s total=%.1fs", video_summary_id, type(e).__name__, error_ref, timer.elapsed())
        logger.error("Stream error ref=%s for %s: %s", error_ref, video_summary_id, e, exc_info=True)

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
        yield sse_event("error", {"message": f"An unexpected error occurred (ref: {error_ref}). Please try again.", "code": error_code.value})

    finally:
        # Clean up override and generation-started state regardless of success/failure
        if video_summary_id:
            clear_override(video_summary_id)
            clear_generation_started(video_summary_id)


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
        logger.info("Using custom provider config: %s", provider_config)
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

    # Refresh presigned URLs for cached visual blocks before emitting
    summary_chapters = summary.get("chapters", [])
    _refresh_frame_urls(summary_chapters)

    for i, chapter in enumerate(summary_chapters):
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
            logger.warning("Failed to check S3 transcript: %s", e)

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
