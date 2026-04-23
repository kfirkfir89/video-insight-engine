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
import os
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
from src.services.cache.pipeline_event_stream import pipeline_event_stream
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


router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Main Streaming Generator (Triage-Driven Pipeline)
# ─────────────────────────────────────────────────────────────────────────────


async def stream_summarization(
    video_summary_id: str,
    entry: dict[str, Any],
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
    force_refresh: bool = False,
) -> AsyncGenerator[str, None]:
    """Triage-driven pipeline: Triage -> Extract -> Enrich -> Synthesize (4-7 LLM calls).

    ``force_refresh=True`` skips the response_cache fast path so a fresh run
    always executes — used by the dev-tools override flow that wants to
    test alternate provider configs against a video that was previously
    cached under the default provider.
    """
    timer = PipelineTimer()

    try:
        youtube_id = entry.get("youtubeId") or entry.get("youtube_id")
        if not youtube_id:
            yield sse_event("error", {"message": "YouTube ID not found"})
            return

        # Check Redis cache first (same YouTube video = instant serve)
        if settings.REDIS_ENABLED and not force_refresh:
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

        # Translation step — translate assembled output to English for non-English videos
        if ctx.language != "en":
            phase_start = time.monotonic()
            try:
                from src.services.pipeline.phases.translation import run_phase_translation
                async for event in run_phase_translation(ctx, repository, video_summary_id):
                    yield event
            except Exception as e:
                logger.warning("[pipeline] Translation failed (non-critical): %s", e)
            ctx.phase_times["translation"] = round(time.monotonic() - phase_start, 1)

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


_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


# Strong references for fire-and-forget producer tasks. The asyncio event loop
# only keeps WEAK refs to tasks created via create_task, so a local variable
# in the route handler is not enough — once the handler returns, the task can
# be garbage-collected mid-run. Holding it in a module-level set fixes that.
_PRODUCER_TASKS: set[asyncio.Task[None]] = set()


async def _heartbeat_lock(video_summary_id: str, owner: str, stop: asyncio.Event) -> None:
    """Periodically extend the producer lock so long pipelines don't lose it.

    The lock TTL is sized for crash recovery (10 min default); without a
    heartbeat, a >10-min pipeline (chunked extraction on a long video, plus
    translation) would lose the lock and a parallel producer could spin up.
    Heartbeat interval is one-third of the TTL — gives two retries before
    expiry if Redis is briefly unreachable.
    """
    interval = max(30, settings.PIPELINE_LOCK_TTL_SECONDS // 3)
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
            return  # stop_event set — pipeline finished
        except asyncio.TimeoutError:
            pass
        extended = await pipeline_event_stream.refresh_lock(video_summary_id, owner)
        if not extended:
            logger.warning(
                "Lock refresh for %s reported not-owned; another worker may "
                "have re-claimed it. Continuing to publish but dedup is at risk.",
                video_summary_id,
            )


async def _produce_to_broker(
    video_summary_id: str,
    entry: dict[str, Any],
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
    owner: str,
) -> None:
    """Run the pipeline and republish each SSE chunk through the broker.

    Lifetime is detached from any single SSE connection — clients can
    abort and reconnect without killing the pipeline. The finally block
    always sends DONE and releases the lock so consumers exit cleanly
    even on producer failure.

    ``stream_summarization`` already catches every pipeline-level error and
    yields a structured error event, so the only exception classes that
    can escape into this function are infrastructure failures (Mongo /
    Redis) and ``CancelledError`` (BaseException, not caught here).
    """
    stop_heartbeat = asyncio.Event()
    heartbeat = asyncio.create_task(
        _heartbeat_lock(video_summary_id, owner, stop_heartbeat),
        name=f"pipeline-lock-heartbeat:{video_summary_id}",
    )
    try:
        # Re-fetch entry for fresh state (the handler's snapshot may be stale).
        try:
            fresh = await asyncio.to_thread(repository.get_video_summary, video_summary_id)
        except OSError as e:
            logger.exception(
                "MongoDB fetch failed for %s during producer startup: %s",
                video_summary_id, e,
            )
            fresh = None
        current_entry = fresh if fresh is not None else entry

        async for chunk in stream_summarization(
            video_summary_id, current_entry, repository, llm_service,
        ):
            try:
                await pipeline_event_stream.publish(video_summary_id, chunk)
            except (OSError, redis_exceptions.RedisError) as e:
                logger.warning(
                    "Broker publish failed for %s (event dropped): %s",
                    video_summary_id, e,
                )
    except (OSError, redis_exceptions.RedisError) as e:
        logger.exception(
            "Pipeline producer infra failure for %s: %s", video_summary_id, e,
        )
        try:
            err_chunk = sse_event("error", {
                "message": "An unexpected error occurred during processing.",
                "code": ErrorCode.UNKNOWN_ERROR.value,
            })
            await pipeline_event_stream.publish(video_summary_id, err_chunk)
        except (OSError, redis_exceptions.RedisError):
            pass
    finally:
        stop_heartbeat.set()
        try:
            await heartbeat
        except asyncio.CancelledError:
            pass
        try:
            await pipeline_event_stream.mark_done(video_summary_id)
        finally:
            await pipeline_event_stream.release_lock(video_summary_id, owner)


async def _consume_from_broker(video_summary_id: str) -> AsyncGenerator[str, None]:
    """Subscribe to the per-video stream and yield SSE chunks until DONE."""
    async for event in pipeline_event_stream.subscribe(video_summary_id):
        yield event
    yield "data: [DONE]\n\n"


async def _direct_stream_fallback(
    video_summary_id: str,
    entry: dict[str, Any],
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
) -> AsyncGenerator[str, None]:
    """Run the pipeline straight to this connection — no broker, no dedup.

    Reserved for the dev-tools "regenerate with custom provider" path: the
    operator wants to re-run the pipeline against the live LLM provider
    override and overwrite whatever's currently stored. Bypassing the broker
    avoids dedup against a previous (default-provider) run, and bypassing
    the response_cache (``force_refresh=True``) avoids serving the stale
    cached output that was generated under the default provider.
    """
    logger.info(
        "Dev-tools direct stream for %s — broker bypassed, response_cache bypassed",
        video_summary_id,
    )
    async for chunk in stream_summarization(
        video_summary_id, entry, repository, llm_service, force_refresh=True,
    ):
        yield chunk
    yield "data: [DONE]\n\n"


def _is_dev_override(entry: dict[str, Any]) -> bool:
    """A non-empty providerConfig is the dev-tools "regenerate with override" signal."""
    return bool(entry.get("providerConfig"))


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

    Concurrency model: a Redis lock makes the first connection the
    pipeline producer; every subsequent connection (StrictMode reconnect,
    additional tab, processing-manager hook) attaches as a consumer of
    the shared event stream. There is at most one pipeline run per
    ``video_summary_id`` no matter how many SSE clients are open.

    Dev-tools override: when the entry carries a ``providerConfig`` (set by
    the admin UI's "Generate with custom provider" flow), the broker and
    response cache are both bypassed so the new run completely overwrites
    whatever the default-provider run produced.
    """
    # Validate ObjectId format
    try:
        ObjectId(video_summary_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid video summary ID format")

    entry = await asyncio.to_thread(repository.get_video_summary, video_summary_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Video summary not found")

    # Apply provider config override (dev tools) by swapping in a custom LLM service.
    is_dev_override = _is_dev_override(entry)
    if is_dev_override:
        provider_config = entry["providerConfig"]
        logger.info("Using custom provider config: %s", provider_config)
        providers = ProviderConfig(
            default=provider_config.get("default", "anthropic"),
            fast=provider_config.get("fast"),
            fallback=provider_config.get("fallback"),
        )
        custom_provider = create_llm_provider(providers)
        llm_service = LLMService(custom_provider)

    # Return cached result if already completed — but only for normal users.
    # Dev-tools override deliberately re-runs to validate the new provider.
    if not is_dev_override and entry.get("status") == ProcessingStatus.COMPLETED.value:
        return StreamingResponse(
            _stream_cached_structured(video_summary_id, entry),
            media_type="text/event-stream",
            headers=_SSE_HEADERS,
        )

    # Dev-tools override path: skip broker + response_cache so the fresh run
    # with the custom provider completely overwrites the existing record.
    if is_dev_override:
        return StreamingResponse(
            _direct_stream_fallback(video_summary_id, entry, repository, llm_service),
            media_type="text/event-stream",
            headers=_SSE_HEADERS,
        )

    # Normal flow: claim producer ownership via the broker. Whoever wins runs
    # the pipeline once; everyone else (including this same client on a
    # StrictMode reconnect) just consumes the shared event stream.
    owner = f"{os.getpid()}-{uuid.uuid4().hex[:8]}"
    try:
        lock_acquired = await pipeline_event_stream.acquire_lock(video_summary_id, owner)
    except (OSError, redis_exceptions.RedisError) as e:
        # Redis unreachable in normal flow is a real outage, not a dev path.
        # Surface 503 so the client knows to retry instead of silently producing
        # duplicate runs (which the broker exists to prevent).
        logger.error(
            "Redis lock acquisition failed for %s: %s", video_summary_id, e,
        )
        raise HTTPException(
            status_code=503,
            detail="Streaming service temporarily unavailable. Please retry.",
        )

    if lock_acquired:
        producer_task = asyncio.create_task(
            _produce_to_broker(video_summary_id, entry, repository, llm_service, owner),
            name=f"pipeline-producer:{video_summary_id}",
        )
        # Hold a strong reference until the task finishes — the event loop only
        # keeps weak refs, so without this the GC could cancel a fire-and-forget
        # producer mid-run.
        _PRODUCER_TASKS.add(producer_task)
        producer_task.add_done_callback(_PRODUCER_TASKS.discard)
        producer_task.add_done_callback(
            lambda t, vid=video_summary_id: (
                logger.error("Producer task for %s ended with exception: %s",
                             vid, t.exception(), exc_info=t.exception())
                if not t.cancelled() and t.exception() is not None else None
            )
        )
    else:
        logger.info(
            "Attaching as additional consumer for %s — pipeline already in progress",
            video_summary_id,
        )

    return StreamingResponse(
        _consume_from_broker(video_summary_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
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
