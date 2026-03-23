"""Phase 7: Assembly — assemble tabs, save to DB, cache, and emit done."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, AsyncGenerator

from src.config import settings
from src.services.cache.response_cache import response_cache
from src.services.media.s3_client import S3Client
from src.services.pipeline.assembly import assemble_response
from src.services.pipeline.pipeline_helpers import sse_event, normalize_segments
from src.services.vector.store import store_transcript_chunks
from src.services.video.description_analyzer import DescriptionAnalysis

if TYPE_CHECKING:
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def run_phase_assembly(ctx: PipelineContext) -> AsyncGenerator[str, None]:
    """Assemble response, emit tab_ready events, save to DB, and emit done."""
    assert ctx.video_data is not None
    assert ctx.triage is not None

    video_meta = {
        "videoId": ctx.video_summary_id,
        "title": ctx.video_data.title,
        "channel": ctx.video_data.channel,
        "duration": ctx.video_data.duration,
        "chapters": [
            {"start_time": ch.start_time, "end_time": ch.end_time, "title": ch.title}
            for ch in (ctx.video_data.chapters or [])
        ],
    }
    desc_analysis_dict = (
        ctx.description_analysis.to_dict()
        if isinstance(ctx.description_analysis, DescriptionAnalysis) and ctx.description_analysis.has_content
        else None
    )
    assembled = assemble_response(
        triage=ctx.triage_dict,
        extraction=ctx.extraction_data,
        enrichment=ctx.enrichment_data,
        synthesis=ctx.synthesis_dict or None,
        video_meta=video_meta,
        description_analysis=desc_analysis_dict,
        frames=ctx.scene_frames_for_assembly,
        gallery_frames=ctx.scene_frames_gallery,
        all_frames=ctx.scene_frames_all,
        frame_descriptions=ctx.frame_descriptions or None,
    )

    # Emit tab_ready events (progressive rendering)
    for tab in assembled.get("tabs", []):
        yield sse_event("tab_ready", tab)

    logger.info("pipeline.assembly", extra={
        "video_id": ctx.video_summary_id,
        "tabs_designed": len(ctx.triage.tabs),
        "tabs_assembled": len(assembled.get("tabs", [])),
        "tabs_dropped": len(ctx.triage.tabs) - len(assembled.get("tabs", [])),
        "components_used": [t["component"] for t in assembled.get("tabs", [])],
    })

    # Emit complete event
    processing_time = int(ctx.timer.elapsed() * 1000)
    yield sse_event("complete", {
        "tabCount": len(assembled.get("tabs", [])),
        "processingTimeMs": processing_time,
    })

    # Save result
    result = {
        "status": "completed",
        "youtubeId": ctx.youtube_id,
        "title": ctx.video_data.title,
        "creator": ctx.video_data.channel,
        "duration": ctx.video_data.duration,
        "thumbnailUrl": ctx.video_data.thumbnail_url,
        "meta": assembled.get("meta", {}),
        "tabs": assembled.get("tabs", []),
        "pipeline": {
            "triage": ctx.triage_dict,
            "extraction": ctx.extraction_data,
            "enrichment": ctx.enrichment_data,
            "synthesis": ctx.synthesis_dict,
            "assembly": {
                "tabsDesigned": len(ctx.triage.tabs),
                "tabsAssembled": len(assembled.get("tabs", [])),
                "tabsDropped": len(ctx.triage.tabs) - len(assembled.get("tabs", [])),
            },
        },
        "processedAt": datetime.now(timezone.utc),
        "processingTimeMs": processing_time,
    }

    await asyncio.to_thread(ctx.repository.save_structured_result, ctx.video_summary_id, result)

    # Build frontend response for Redis cache
    from src.routes.cached_response import build_frontend_response
    frontend_response = build_frontend_response(result)

    # Cache in Redis (non-blocking, best-effort)
    if settings.REDIS_ENABLED:
        try:
            await response_cache.set_response(ctx.youtube_id, frontend_response)
        except (OSError, ConnectionError) as e:
            logger.debug("Redis cache failed (non-critical): %s", e)

    # Store transcript chunks in Qdrant (background, non-blocking)
    if settings.QDRANT_ENABLED:
        def _log_qdrant_error(t: asyncio.Task) -> None:
            if t.cancelled():
                return
            exc = t.exception()
            if exc:
                logger.error("Qdrant store failed: %s", exc)

        task = asyncio.create_task(store_transcript_chunks(ctx.youtube_id, ctx.clean_text))
        task.add_done_callback(_log_qdrant_error)

    # Store raw transcript to S3 (background, non-blocking, best-effort)
    if S3Client.is_available() and ctx.transcript_data:
        async def _store_transcript() -> None:
            try:
                from src.services.transcription.transcript_store import transcript_store
                normalized = normalize_segments(ctx.transcript_data.segments)
                s3_key = await transcript_store.store(
                    youtube_id=ctx.youtube_id,
                    segments=normalized,
                    source=ctx.transcript_data.source,
                )
                await asyncio.to_thread(
                    ctx.repository._collection.update_one,
                    {"_id": ctx.video_summary_id},
                    {"$set": {"rawTranscriptRef": s3_key}},
                )
                logger.info("Stored transcript in S3: %s", s3_key)
            except Exception as e:
                logger.warning("Transcript S3 storage failed (non-critical): %s", e)

        def _log_transcript_error(t: asyncio.Task) -> None:
            if t.cancelled():
                return
            exc = t.exception()
            if exc:
                logger.warning("Transcript S3 background task failed: %s", exc)

        transcript_task = asyncio.create_task(_store_transcript())
        transcript_task.add_done_callback(_log_transcript_error)

    yield sse_event("done", {"videoSummaryId": ctx.video_summary_id, "processingTimeMs": processing_time})
    yield "data: [DONE]\n\n"
