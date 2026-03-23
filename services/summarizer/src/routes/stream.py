"""SSE streaming endpoint for triage-driven video summarization.

Pipeline: Triage -> Extract -> Enrich -> Synthesize (4-7 LLM calls).

Phases:
1. INSTANT: Metadata from yt-dlp
2. TRANSCRIPT: Fetch and clean transcript
3. TRIAGE: Determine content domains and tab layout
4. EXTRACTION: Adaptive structured extraction (1-3 calls)
5. ENRICHMENT: Quiz/flashcards/cheat sheet (conditional)
6. SYNTHESIS: TLDR, takeaways, master summary
"""

import asyncio
import logging
import time
import uuid
from typing import Annotated, Any, AsyncGenerator

from pydantic import BaseModel

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from llm_common.context import llm_video_id_var  # noqa: F401 — used in phases
from litellm.exceptions import APIError as LitellmAPIError, RateLimitError, Timeout as LitellmTimeout
import redis.exceptions as redis_exceptions

from src.config import settings
from src.dependencies import get_video_repository, get_llm_service, create_llm_provider
from src.models.schemas import ProcessingStatus, ErrorCode, ProviderConfig
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService
from src.exceptions import TranscriptError
from src.services.media.s3_client import s3_client
from src.services.cache.response_cache import response_cache
from src.services.override_state import clear_override
from src.services.pipeline.context import PipelineContext
from src.services.pipeline.pipeline_helpers import sse_event, PipelineTimer, run_parallel_phases
from src.routes.cached_response import (
    build_frontend_response,  # noqa: F401 — re-exported for backward compat
    stream_cached_structured as _stream_cached_structured,
)
from src.services.pipeline.phases import (
    run_phase_metadata,
    run_phase_transcript,
    run_phase_frames,
    run_phase_plan,
    run_phase_extraction,
    run_phase_synthesis,
    run_phase_enrichment,
    run_phase_assembly,
)

logger = logging.getLogger(__name__)

# In-memory lock to prevent duplicate pipeline runs for the same video.
# IMPORTANT: Only safe for single-process asyncio deployments.  All dict
# mutations happen on the main event-loop thread, so no external lock is
# needed.  Multi-process/multi-worker deployments require Redis-based locking.
# TODO: Migrate to Redis-based locking when scaling to multiple workers.
_processing_locks: dict[str, tuple[asyncio.Event, float]] = {}
_LOCK_TTL_SECONDS = 360  # 60s buffer beyond wait_for timeout to prevent cleanup/wait race
_LOCK_MAX_SIZE = 500  # Hard cap to prevent unbounded growth between cleanups
_last_lock_cleanup: float = 0.0


def _cleanup_stale_locks() -> None:
    """Remove locks older than TTL to prevent memory leaks from abandoned connections.

    Throttled to run at most once per 60 seconds to avoid O(n) scan per request.
    Also enforces a hard cap on dict size for burst protection.

    Re-validates staleness at pop time to avoid removing a freshly-inserted
    lock that replaced the stale one between scan and pop (TOCTOU).
    """
    global _last_lock_cleanup
    now = time.monotonic()
    if now - _last_lock_cleanup < 60 and len(_processing_locks) <= _LOCK_MAX_SIZE:
        return
    _last_lock_cleanup = now
    if len(_processing_locks) > _LOCK_MAX_SIZE:
        logger.warning("Processing lock dict exceeded max size (%d > %d), forcing cleanup", len(_processing_locks), _LOCK_MAX_SIZE)
    stale_keys = [k for k, (_, created) in _processing_locks.items() if now - created > _LOCK_TTL_SECONDS]
    for k in stale_keys:
        entry = _processing_locks.get(k)
        # Re-check: only pop if the entry is still the same stale one
        if entry and now - entry[1] > _LOCK_TTL_SECONDS:
            popped = _processing_locks.pop(k, None)
            # Only signal the event if we popped the exact same stale entry
            # (prevents signaling a freshly-inserted lock from a new pipeline run)
            if popped is entry:
                entry[0].set()  # Unblock any waiters

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Main Streaming Generator (Triage-Driven Pipeline)
# ─────────────────────────────────────────────────────────────────────────────


async def stream_summarization(
    video_summary_id: str,
    entry: dict[str, Any],
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
) -> AsyncGenerator[str, None]:
    """Triage-driven pipeline: Triage -> Extract -> Enrich -> Synthesize (4-7 LLM calls)."""
    timer = PipelineTimer()

    try:
        youtube_id = entry.get("youtubeId") or entry.get("youtube_id")
        if not youtube_id:
            yield sse_event("error", {"message": "YouTube ID not found"})
            return

        # Check Redis cache first (same YouTube video = instant serve)
        if settings.REDIS_ENABLED:
            try:
                cached = await response_cache.get_response(youtube_id)
                cached_meta = cached.get("meta", {}) if isinstance(cached, dict) else {}
                if (
                    cached
                    and isinstance(cached, dict)
                    and cached.get("status") == ProcessingStatus.COMPLETED.value
                    and cached.get("youtubeId") == youtube_id  # Verify cache integrity
                    and isinstance(cached.get("tabs"), list)  # Required field present
                    and len(cached["tabs"]) > 0  # Reject empty tab lists
                    and isinstance(cached["tabs"][0], dict)  # Spot-check first tab
                    and isinstance(cached_meta, dict)
                    and len(cached_meta) > 0  # Reject empty meta
                ):
                    logger.info("[pipeline] Redis cache HIT for youtube_id=%s", youtube_id)
                    # Fire-and-forget DB save — don't block the cache-hit fast path
                    if entry.get("status") != ProcessingStatus.COMPLETED.value:
                        _vid_id = video_summary_id  # capture for lambda
                        task = asyncio.create_task(asyncio.to_thread(repository.save_structured_result, video_summary_id, cached))
                        task.add_done_callback(
                            lambda t, vid=_vid_id: logger.error(
                                "Cache-hit DB save failed for %s: %s", vid, t.exception(),
                            ) if t.exception() else None
                        )
                    async for event in _stream_cached_structured(video_summary_id, cached):
                        yield event
                    return
            except (OSError, redis_exceptions.ConnectionError) as e:
                logger.debug("Redis cache check failed (non-critical): %s", e)

        await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.PROCESSING)
        logger.info("[pipeline] START video_id=%s youtube_id=%s", video_summary_id, youtube_id)

        # Set video context for LLM usage tracking
        llm_video_id_var.set(youtube_id)

        ctx = PipelineContext(
            video_summary_id=video_summary_id,
            youtube_id=youtube_id,
            entry=entry,
            repository=repository,
            llm_service=llm_service,
            timer=timer,
        )

        # Phase 1: Metadata (sequential — sets video_data needed by everything)
        phase_start = time.monotonic()
        async for event in run_phase_metadata(ctx):
            yield event
        ctx.phase_times["metadata"] = round(time.monotonic() - phase_start, 1)

        # Phase 2: Transcript + Frames (parallel — both only need youtube_id + video_data)
        phase_start = time.monotonic()
        async for event in run_parallel_phases([run_phase_transcript, run_phase_frames], ctx):
            yield event
        ctx.phase_times["transcript_frames"] = round(time.monotonic() - phase_start, 1)

        # Phase 2.5: Inject visual context into transcript (after both phases complete)
        phase_start = time.monotonic()
        if ctx.clean_text and (ctx.frame_descriptions or ctx.scene_frames_all):
            from src.services.pipeline.scene_frames import inject_visual_context

            segments = ctx.transcript_data.segments if ctx.transcript_data else None
            ctx.clean_text = inject_visual_context(
                ctx.clean_text, segments, ctx.frame_descriptions, ctx.scene_frames_all,
            )
            annotation_count = ctx.clean_text.count("[VISUAL at") + ctx.clean_text.count("[ON-SCREEN TEXT at")
            if annotation_count:
                logger.info("[pipeline] Injected %d visual annotations into transcript", annotation_count)
        ctx.phase_times["visual_inject"] = round(time.monotonic() - phase_start, 1)

        # Phase 3-6: Sequential (each depends on the previous)
        # Note: synthesis depends on extraction_data, so they cannot be parallelized.
        for phase in [
            run_phase_plan,
            run_phase_extraction,
            run_phase_synthesis,
            run_phase_enrichment,
            run_phase_assembly,
        ]:
            phase_start = time.monotonic()
            async for event in phase(ctx):
                yield event
            ctx.phase_times[phase.__name__.replace("run_phase_", "")] = round(time.monotonic() - phase_start, 1)

        # One-line pipeline summary with ALL phase timings
        pt = ctx.phase_times
        plan_ok = "ok" if ctx.plan_result is not None else "FAIL"
        enrich_ok = "ok" if ctx.enrichment_data else "FAIL"
        logger.info(
            "[pipeline] DONE youtube_id=%s in %.0fs | "
            "metadata=%.1fs transcript_frames=%.1fs visual_inject=%.1fs "
            "plan=%.1fs(%s) extraction=%.1fs synthesis=%.1fs enrichment=%.1fs(%s) assembly=%.1fs | tabs=%d",
            youtube_id, timer.elapsed(),
            pt.get("metadata", 0),
            pt.get("transcript_frames", 0),
            pt.get("visual_inject", 0),
            pt.get("plan", 0), plan_ok,
            pt.get("extraction", 0),
            pt.get("synthesis", 0),
            pt.get("enrichment", 0), enrich_ok,
            pt.get("assembly", 0),
            len(ctx.triage.tabs) if ctx.triage else 0,
        )

    except TranscriptError as e:
        logger.info("[pipeline] FAILED video_id=%s error=TranscriptError total=%.1fs", video_summary_id, timer.elapsed())
        await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        yield sse_event("error", {"message": str(e), "code": e.code.value})

    except RateLimitError as e:
        logger.warning("[pipeline] FAILED video_id=%s error=RateLimitError total=%.1fs", video_summary_id, timer.elapsed())
        await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.RATE_LIMITED)
        yield sse_event("error", {"message": "AI service rate limited. Please try again in a moment.", "code": ErrorCode.RATE_LIMITED.value})

    except LitellmTimeout as e:
        logger.warning("[pipeline] FAILED video_id=%s error=Timeout total=%.1fs", video_summary_id, timer.elapsed())
        await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "Request took too long. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except LitellmAPIError as e:
        logger.error("[pipeline] FAILED video_id=%s error=APIError total=%.1fs", video_summary_id, timer.elapsed())
        await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "AI service error. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except Exception as e:
        error_ref = str(uuid.uuid4())[:8]
        logger.error("[pipeline] FAILED video_id=%s error=%s ref=%s total=%.1fs", video_summary_id, type(e).__name__, error_ref, timer.elapsed(), exc_info=True)
        await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.UNKNOWN_ERROR)
        yield sse_event("error", {"message": f"An unexpected error occurred (ref: {error_ref}).", "code": ErrorCode.UNKNOWN_ERROR.value})
    finally:
        await asyncio.to_thread(clear_override, video_summary_id)


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

    Triage-driven pipeline delivers content in phases:
    1. INSTANT (~1 sec): Metadata from yt-dlp
    2. TRANSCRIPT: Fetch and clean transcript
    3. TRIAGE: Determine content domains and tab layout
    4. EXTRACTION: Adaptive structured extraction (1-3 calls)
    5. ENRICHMENT: Quiz/flashcards/cheat sheet (conditional)
    6. SYNTHESIS: TLDR, takeaways, master summary
    """
    # Validate ObjectId format
    try:
        ObjectId(video_summary_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid video summary ID format")

    entry = await asyncio.to_thread(repository.get_video_summary, video_summary_id)
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
            _stream_cached_structured(video_summary_id, entry),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    # Prevent duplicate pipeline runs: if another connection is already processing
    # this video, wait for it to finish and serve the cached result.
    _cleanup_stale_locks()  # Periodic cleanup to prevent memory leaks from abandoned connections

    # Atomic check-and-register: setdefault returns existing lock if present,
    # otherwise inserts new_lock. This avoids TOCTOU race between check and set.
    new_lock = (asyncio.Event(), time.monotonic())
    existing_lock = _processing_locks.setdefault(video_summary_id, new_lock)

    if existing_lock is not new_lock:
        # Another request is already processing this video — wait for it
        logger.info("Duplicate stream request for %s — waiting for existing pipeline", video_summary_id)
        try:
            await asyncio.wait_for(existing_lock[0].wait(), timeout=300)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Pipeline timed out waiting for existing run")
        entry = await asyncio.to_thread(repository.get_video_summary, video_summary_id)
        if entry and entry.get("status") == ProcessingStatus.COMPLETED.value:
            # Clean up any stale lock before returning — prevents memory leak
            _processing_locks.pop(video_summary_id, None)
            return StreamingResponse(
                _stream_cached_structured(video_summary_id, entry),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
            )
        if entry and entry.get("status") == ProcessingStatus.FAILED.value:
            _processing_locks.pop(video_summary_id, None)
            raise HTTPException(status_code=502, detail="Previous pipeline run failed. Please retry.")
        # Status is stuck PROCESSING — try to atomically claim ownership.
        # Use setdefault so only one concurrent waiter-fallthrough wins the race.
        new_lock = (asyncio.Event(), time.monotonic())
        actual = _processing_locks.setdefault(video_summary_id, new_lock)
        if actual is not new_lock:
            # Another waiter already claimed it — reject this request
            raise HTTPException(status_code=409, detail="Pipeline already running. Please retry.")

    # Capture entry as fallback — but re-fetch inside the stream for freshness
    fallback_entry: dict[str, Any] = entry  # type: ignore[assignment]  # guaranteed non-None at this point

    async def _locked_stream() -> AsyncGenerator[str, None]:
        try:
            # Re-fetch entry for fresh state (outer entry may be stale
            # after waiting for a lock or when the lock-wait path falls through).
            fresh = await asyncio.to_thread(repository.get_video_summary, video_summary_id)
            current_entry: dict[str, Any] = fresh if fresh is not None else fallback_entry
            async for chunk in stream_summarization(video_summary_id, current_entry, repository, llm_service):
                yield chunk
        finally:
            lock = _processing_locks.pop(video_summary_id, None)
            if lock:
                lock[0].set()

    return StreamingResponse(
        _locked_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Regeneration Endpoint
# ─────────────────────────────────────────────────────────────────────────────


class RegenerateRequest(BaseModel):
    """Request body for regeneration endpoint."""
    force: bool = False


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
    """Trigger regeneration of a video summary."""
    try:
        ObjectId(video_summary_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid video summary ID format")

    entry = await asyncio.to_thread(repository.get_video_summary, video_summary_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Video summary not found")

    has_raw_transcript = False
    raw_transcript_ref = entry.get("rawTranscriptRef")

    if raw_transcript_ref and s3_client.is_available():
        try:
            has_raw_transcript = await s3_client.exists(raw_transcript_ref)
        except Exception as e:
            logger.warning("Failed to check S3 transcript: %s", e)

    if not has_raw_transcript and not request.force:
        return RegenerateResponse(
            status="unavailable",
            video_summary_id=video_summary_id,
            message="Raw transcript not available in S3. Use force=true to re-fetch from YouTube.",
            has_raw_transcript=False,
            generation=entry.get("generation"),
        )

    await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.PENDING)

    # Invalidate Redis cache for this video
    youtube_id = entry.get("youtubeId") or entry.get("youtube_id")
    if youtube_id and settings.REDIS_ENABLED:
        try:
            await response_cache.invalidate(youtube_id)
            logger.info("Invalidated Redis cache for youtube_id=%s", youtube_id)
        except (OSError, redis_exceptions.ConnectionError) as e:
            logger.debug("Redis cache invalidation failed (non-critical): %s", e)

    return RegenerateResponse(
        status="ready",
        video_summary_id=video_summary_id,
        message="Video summary ready for regeneration. Connect to streaming endpoint to process.",
        has_raw_transcript=has_raw_transcript,
        generation=entry.get("generation"),
    )
