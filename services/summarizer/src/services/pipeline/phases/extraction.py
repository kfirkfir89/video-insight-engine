"""Phase 4: Extraction — adaptive structured extraction with count validation."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, AsyncGenerator

from llm_common.context import llm_feature_var

from src.config import settings
from src.models.schemas import ProcessingStatus, ErrorCode
from src.services.pipeline.extractor import extract
from src.services.pipeline.pipeline_helpers import normalize_segments, sse_event
from src.services.pipeline.post_processor import validate_extraction_counts

if TYPE_CHECKING:
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def run_phase_extraction(ctx: PipelineContext) -> AsyncGenerator[str, None]:
    """Run adaptive extraction and optional count-validation retry."""
    llm_feature_var.set("summarize:extraction")
    assert ctx.triage is not None
    assert ctx.video_data is not None

    video_info = {
        "title": ctx.video_data.title,
        "channel": ctx.video_data.channel,
        "duration": ctx.video_data.duration,
        "chapters": getattr(ctx.video_data, "chapters", None),
    }

    # Chapter splitting for long videos (>30 min)
    chapters = None
    duration = ctx.video_data.duration or 0
    if duration > settings.CHUNKED_EXTRACTION_THRESHOLD and ctx.transcript_data:
        try:
            from src.services.transcription.transcript_chunker import split_transcript_into_chapters
            raw_segments = ctx.transcript_data.segments if hasattr(ctx.transcript_data, "segments") else []
            # Convert TranscriptSegment objects to dicts, then normalize to startMs/endMs
            seg_as_dicts = []
            for seg in raw_segments:
                if isinstance(seg, dict):
                    seg_as_dicts.append(seg)
                elif hasattr(seg, "text"):
                    d: dict = {"text": seg.text}
                    if hasattr(seg, "startMs"):
                        d["startMs"] = seg.startMs
                        d["endMs"] = getattr(seg, "endMs", seg.startMs)
                    elif hasattr(seg, "start"):
                        d["start"] = seg.start
                        d["duration"] = getattr(seg, "duration", 0)
                    seg_as_dicts.append(d)
            seg_dicts = normalize_segments(seg_as_dicts)

            chapters = await split_transcript_into_chapters(
                video_data=video_info,
                segments=seg_dicts,
                transcript=ctx.clean_text,
                llm_service=ctx.llm_service,
            )
            ctx.chapters = chapters
            logger.info("Prepared %d chapters for chunked extraction", len(chapters))
        except Exception as e:
            logger.warning("Chapter splitting failed (non-critical): %s — falling back to standard extraction", e)
            chapters = None

    async for evt in extract(ctx.llm_service, ctx.triage, ctx.clean_text, video_info, chapters=chapters, video_context=ctx.video_dna_compact):
        event_name = evt["event"]
        yield sse_event(event_name, {k: v for k, v in evt.items() if k != "event"})
        if event_name == "extraction_complete":
            ctx.extraction_data = evt.get("data")

    if not ctx.extraction_data:
        logger.error("[pipeline] Extraction produced no data for video_id=%s", ctx.video_summary_id)
        await asyncio.to_thread(ctx.repository.update_status, ctx.video_summary_id, ProcessingStatus.FAILED, "Extraction failed", ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "Extraction failed to produce data", "code": ErrorCode.LLM_ERROR.value})
        return

    logger.info("pipeline.extraction", extra={
        "video_id": ctx.video_summary_id,
        "domains_extracted": list(ctx.extraction_data.keys()) if isinstance(ctx.extraction_data, dict) else [],
        "items_per_domain": {
            k: sum(1 for v in d.values() if isinstance(v, list) and len(v) > 0)
            for k, d in ctx.extraction_data.items() if isinstance(d, dict)
        } if isinstance(ctx.extraction_data, dict) else {},
    })

    # Count validation (advisory logging only — no retry)
    if ctx.extraction_data and ctx.plan_result is not None:
        count_warnings = validate_extraction_counts(ctx.plan_result, ctx.extraction_data)
        if count_warnings:
            logger.warning(
                "[pipeline] Extraction count mismatch for video_id=%s: %s",
                ctx.video_summary_id, count_warnings,
            )
