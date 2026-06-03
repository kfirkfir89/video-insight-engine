"""Pipeline orchestration for the summarizer service.

Drives the phase-by-phase pipeline, opens the Langfuse parent trace, and
spawns the fire-and-forget faithfulness judge. The broker fan-out (which
republishes the SSE stream through Redis so concurrent SSE consumers
dedupe to a single pipeline run) lives in :mod:`src.routes.pipeline_broker` —
keeping that out of here lets this file stay focused on the pipeline itself.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, AsyncGenerator

from litellm.exceptions import APIError as LitellmAPIError, RateLimitError, Timeout as LitellmTimeout
import redis.exceptions as redis_exceptions
import structlog

from llm_common.context import (  # noqa: F401 — llm_feature_var used in phases
    llm_feature_var,
    llm_request_id_var,
    llm_user_id_var,
    llm_video_id_var,
    llm_video_summary_id_var,
)

from src.config import settings
from src.exceptions import TranscriptError
from src.models.schemas import ProcessingStatus, ErrorCode
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.routes.cached_response import stream_cached_structured as _stream_cached_structured
from src.services.cache.response_cache import response_cache
from src.services.llm import LLMService
from src.services.observability import pipeline_trace, update_trace_metadata
from src.services.override_state import clear_override
from src.services.pipeline.context import PipelineContext
from src.services.pipeline.pipeline_helpers import (
    PipelineTimer,
    run_parallel_phases,
    sse_event,
)
from src.services.pipeline.phases import (
    run_phase_assembly,
    run_phase_enrichment,
    run_phase_extraction,
    run_phase_frames,
    run_phase_metadata,
    run_phase_plan,
    run_phase_synthesis,
    run_phase_transcript,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Module-level task registries
# ─────────────────────────────────────────────────────────────────────────────


# Strong refs for fire-and-forget faithfulness tasks — the asyncio loop only
# keeps weak refs to tasks created via ``create_task``, so without a
# module-level set the GC can cancel the judge mid-call.
_FAITHFULNESS_TASKS: set[asyncio.Task[None]] = set()


# Bounded wait when draining in-flight faithfulness tasks at trace exit. The
# judge itself caps each LLM call at ``_JUDGE_TIMEOUT_SECONDS = 20`` (parallel
# fan-out), so 25s leaves a small margin without delaying SSE clients on a
# stuck judge.
_FAITHFULNESS_DRAIN_TIMEOUT_S = 25.0


# ─────────────────────────────────────────────────────────────────────────────
# Faithfulness judge (fire-and-forget)
# ─────────────────────────────────────────────────────────────────────────────


def _launch_faithfulness_check(ctx: PipelineContext) -> asyncio.Task[None] | None:
    """Spawn the faithfulness judge in the background — never blocks.

    Returns the spawned task so the caller can await it before flushing the
    parent Langfuse trace (otherwise the score may be added to the SDK
    buffer after explicit flush and lost on shutdown).
    """
    if not ctx.extraction_data or not ctx.clean_text:
        return None
    try:
        from src.services.pipeline.faithfulness import run_faithfulness_check
    except ImportError as exc:
        logger.debug("Faithfulness module unavailable: %s", exc)
        return None

    async def _run() -> None:
        # asyncio.create_task snapshots the parent task's ContextVars at spawn
        # time, which means this task inherits "summarize:extraction" from the
        # extraction phase that just ran. Without this re-set, every judge LLM
        # call is attributed to extraction in cost tracking instead of its
        # own stage. Setting it inside the spawned task is scoped to this task
        # only — it doesn't leak back to the parent.
        llm_feature_var.set("summarize:faithfulness")
        try:
            await run_faithfulness_check(
                llm_service=ctx.llm_service,
                transcript=ctx.clean_text or "",
                extraction_data=ctx.extraction_data or {},
                youtube_id=ctx.youtube_id,
            )
        except Exception as exc:  # noqa: BLE001 — defensive; check is non-critical
            logger.debug("Faithfulness task failed: %s", exc)

    task = asyncio.create_task(_run(), name=f"faithfulness:{ctx.youtube_id}")
    _FAITHFULNESS_TASKS.add(task)
    task.add_done_callback(_FAITHFULNESS_TASKS.discard)
    return task


async def _drain_faithfulness(tasks: list[asyncio.Task[None]]) -> None:
    """Wait for in-flight faithfulness tasks before the Langfuse trace flushes.

    Bounded by ``_FAITHFULNESS_DRAIN_TIMEOUT_S`` so a stuck judge can't
    delay SSE completion. The score is best-effort; any task still running
    after the timeout is left to complete on its own (and its score will
    flush on the SDK's next periodic drain).
    """
    pending = [t for t in tasks if not t.done()]
    if not pending:
        return
    try:
        await asyncio.wait(pending, timeout=_FAITHFULNESS_DRAIN_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — never block trace exit
        logger.debug("Faithfulness drain failed: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline phase orchestration
# ─────────────────────────────────────────────────────────────────────────────


async def _run_pipeline_phases(
    ctx: PipelineContext,
    repository: MongoDBVideoRepository,
    video_summary_id: str,
    timer: PipelineTimer,
) -> AsyncGenerator[str, None]:
    """Run every pipeline phase in order, streaming SSE chunks to the caller.

    Lives inside the Langfuse ``pipeline_trace`` context so every LLM span
    attaches to the parent trace. Phase timings are recorded on ``ctx`` for
    the final summary log. Any faithfulness tasks spawned mid-pipeline are
    drained before this coroutine returns so their scores reach Langfuse
    before the trace is flushed.
    """
    youtube_id = ctx.youtube_id
    spawned_faithfulness: list[asyncio.Task[None]] = []

    try:
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

        # Phase 3-6: Sequential (each depends on the previous).
        # synthesis depends on extraction_data, so they cannot be parallelized.
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
            # Fire-and-forget faithfulness judge once extraction has data. The
            # task copies the current ContextVar state so the Langfuse trace is
            # still attached. We track the task so we can drain it before
            # exiting the trace.
            if phase is run_phase_extraction and ctx.extraction_data:
                spawned = _launch_faithfulness_check(ctx)
                if spawned is not None:
                    spawned_faithfulness.append(spawned)

        # Translation step — translate the English output into the source
        # language and attach it as ``sourceLanguage`` for the FE toggle.
        if ctx.source_language_code:
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
    finally:
        # Drain in-flight faithfulness tasks BEFORE the surrounding
        # ``pipeline_trace`` exits and flushes — otherwise the judge's
        # ``log_score`` lands in the SDK buffer after explicit flush and
        # may be lost on container stop.
        await _drain_faithfulness(spawned_faithfulness)


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

        # Open the Langfuse parent trace BEFORE the cache lookup so cache
        # hits are observable too. Without this, the Redis-hit fast path
        # produced zero spans and dashboards under-counted the actual
        # request volume. ``cacheHit`` is set via ``update_trace_metadata``
        # once the cache lookup resolves.
        # ``requestId`` is pulled from structlog contextvars (the worker binds
        # it from the queue payload) so Sentry events, log lines, and Langfuse
        # traces share the same correlation id. Only added when present —
        # the SSE-direct path (e.g. dev override) doesn't bind one and we don't
        # want ``null`` polluting Langfuse dashboards.
        # ``request_id`` and ``user_id`` come from structlog contextvars, which
        # the worker binds from the queue payload (see worker/runner.py). The
        # ``entry`` row is the cross-user ``videoSummaryCache`` doc — it is
        # content-addressed and shared across users, so it carries no per-run
        # owner; ``entry.get("userId")`` is a best-effort fallback for any
        # SSE-direct path that sets it on the doc.
        ctxvars = structlog.contextvars.get_contextvars()
        request_id = ctxvars.get("request_id")
        user_id = entry.get("userId") or ctxvars.get("user_id")

        # Set LLM cost-tracking context vars BEFORE the cache lookup so every
        # ``llm_usage`` row this run writes — including the rare cache-hit-path
        # LLM call — is attributable to its user, video, run, and request. These
        # are the keys per-user reconciliation and run grouping match on.
        llm_video_id_var.set(youtube_id)
        llm_video_summary_id_var.set(video_summary_id)
        if user_id:
            llm_user_id_var.set(user_id)
        if request_id:
            llm_request_id_var.set(request_id)

        trace_tags = [f"youtubeId:{youtube_id}", f"videoSummaryId:{video_summary_id}"]
        trace_metadata: dict[str, Any] = {
            "youtubeId": youtube_id,
            "videoSummaryId": video_summary_id,
            "userId": user_id,
            "language": entry.get("language"),
        }
        if request_id:
            trace_tags.append(f"requestId:{request_id}")
            trace_metadata["requestId"] = request_id
        async with pipeline_trace(
            video_summary_id, tags=trace_tags, metadata=trace_metadata,
            user_id=user_id,
        ):
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
                        update_trace_metadata({"cacheHit": True, "cacheSource": "redis"})
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

            update_trace_metadata({"cacheHit": False})

            await asyncio.to_thread(repository.update_status, video_summary_id, ProcessingStatus.PROCESSING)
            logger.info("[pipeline] START video_id=%s youtube_id=%s", video_summary_id, youtube_id)

            ctx = PipelineContext(
                video_summary_id=video_summary_id,
                youtube_id=youtube_id,
                entry=entry,
                repository=repository,
                llm_service=llm_service,
                timer=timer,
            )

            async for event in _run_pipeline_phases(ctx, repository, video_summary_id, timer):
                yield event

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


