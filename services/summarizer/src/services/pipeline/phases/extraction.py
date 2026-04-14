"""Phase 4: Extraction — adaptive structured extraction with count validation."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any, AsyncGenerator

from llm_common.context import llm_feature_var

from src.config import settings
from src.models.schemas import ProcessingStatus, ErrorCode
from src.services.pipeline.extraction_quality import check_extraction_quality, build_synthesis_fed_retry_prompt
from src.services.pipeline.extractor import extract
from src.services.pipeline.pipeline_helpers import normalize_segments, sse_event, truncate_json_safely
from src.services.pipeline.post_processor import validate_extraction_counts
from src.services.pipeline.synthesis import synthesize
from src.utils.language_utils import build_language_instruction

if TYPE_CHECKING:
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def _attempt_synthesis_fed_retry(
    ctx: PipelineContext,
    plan_tabs: list[dict],
    quality: Any,
    video_info: dict,
    chapters: Any,
) -> None:
    """Run synthesis early, then re-extract with evidence-based guidance.

    Mutates ctx.extraction_data (if retry improves quality) and ctx.synthesis_dict.
    """
    if ctx.video_data is None or ctx.triage is None:
        logger.warning("[pipeline] Cannot retry extraction: missing video_data or triage")
        return

    extraction_summary = truncate_json_safely(ctx.extraction_data, 4000)
    synthesis_result = await synthesize(
        ctx.llm_service,
        title=ctx.video_data.title,
        channel=ctx.video_data.channel,
        duration=ctx.video_data.duration,
        output_type=ctx.triage.primary_tag,
        extraction_summary=extraction_summary,
        video_context=ctx.video_dna_compact,
    )
    ctx.synthesis_dict = synthesis_result.model_dump(by_alias=True)

    retry_prompt = build_synthesis_fed_retry_prompt(
        quality.empty_fields, ctx.synthesis_dict,
    )

    retry_data = None
    async for evt in extract(
        ctx.llm_service, ctx.triage, ctx.clean_text, video_info,
        chapters=chapters, video_context=ctx.video_dna_compact,
        extra_instruction=retry_prompt,
        language_instruction=build_language_instruction(ctx.language),
    ):
        if evt["event"] == "extraction_complete":
            retry_data = evt.get("data")

    if retry_data:
        retry_quality = check_extraction_quality(plan_tabs, retry_data)
        if retry_quality.score > quality.score:
            ctx.extraction_data = retry_data
            logger.info(
                "[pipeline] Extraction retry improved quality: %.2f → %.2f",
                quality.score, retry_quality.score,
            )
        else:
            logger.info(
                "[pipeline] Extraction retry did not improve quality (%.2f vs %.2f), keeping original",
                retry_quality.score, quality.score,
            )


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

    lang_instruction = build_language_instruction(ctx.language)
    try:
        async for evt in extract(ctx.llm_service, ctx.triage, ctx.clean_text, video_info, chapters=chapters, video_context=ctx.video_dna_compact, language_instruction=lang_instruction):
            event_name = evt["event"]
            yield sse_event(event_name, {k: v for k, v in evt.items() if k != "event"})
            if event_name == "extraction_complete":
                ctx.extraction_data = evt.get("data")
    except (ValueError, asyncio.TimeoutError) as e:
        logger.warning("[pipeline] Extraction raised %s for video_id=%s: %s — continuing with empty extraction", type(e).__name__, ctx.video_summary_id, e)

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

    # Quality check + conditional synthesis-fed retry
    if ctx.extraction_data and ctx.triage is not None and ctx.plan_result is not None:
        plan_tabs = ctx.plan_result.tabs
        quality = check_extraction_quality(plan_tabs, ctx.extraction_data)
        logger.info(
            "pipeline.extraction_quality",
            extra={
                "video_id": ctx.video_summary_id,
                "score": quality.score,
                "populated": quality.populated,
                "total": quality.total,
                "empty_fields": quality.empty_fields,
            },
        )

        if quality.score < 0.6 and quality.total > 0:
            logger.warning(
                "[pipeline] Low extraction quality (%.2f) for video_id=%s — attempting synthesis-fed retry",
                quality.score, ctx.video_summary_id,
            )
            try:
                await _attempt_synthesis_fed_retry(ctx, plan_tabs, quality, video_info, chapters)
            except Exception as e:
                logger.warning("[pipeline] Extraction retry failed (non-critical): %s", e)

    # Count validation (advisory logging only — no retry)
    if ctx.extraction_data and ctx.plan_result is not None:
        count_warnings = validate_extraction_counts(ctx.plan_result, ctx.extraction_data)
        if count_warnings:
            logger.warning(
                "[pipeline] Extraction count mismatch for video_id=%s: %s",
                ctx.video_summary_id, count_warnings,
            )
