"""SSE streaming endpoint for intent-driven video summarization.

Pipeline: Intent -> Extract -> Enrich -> Synthesize (4-7 LLM calls).

Phases:
1. INSTANT: Metadata from yt-dlp
2. TRANSCRIPT: Fetch and clean transcript
3. INTENT: Detect output type and sections
4. EXTRACTION: Adaptive structured extraction (1-3 calls)
5. ENRICHMENT: Quiz/flashcards/cheat sheet (conditional)
6. SYNTHESIS: TLDR, takeaways, master summary
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any, AsyncGenerator

from pydantic import BaseModel

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from llm_common.context import llm_video_id_var, llm_feature_var
from litellm.exceptions import APIError as LitellmAPIError, RateLimitError, Timeout as LitellmTimeout

from src.dependencies import get_video_repository, get_llm_service, create_llm_provider
from src.models.schemas import ProcessingStatus, ErrorCode, ProviderConfig, TranscriptSegment
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService
from src.services.transcription.transcript import clean_transcript
from src.services.video.youtube import extract_video_data
from src.services.video.description_analyzer import analyze_description, DescriptionAnalysis
from src.services.video.sponsorblock import get_sponsor_segments, filter_transcript_segments
from src.exceptions import TranscriptError
from src.services.pipeline.intent_detector import detect_intent, get_canonical_sections
from src.services.pipeline.extractor import extract
from src.services.pipeline.synthesis import synthesize
from src.services.pipeline.enrichment import enrich
from src.services.media.s3_client import s3_client
from src.services.transcription.transcript_fetcher import fetch_transcript
from src.services.override_state import check_override, clear_override
from src.services.pipeline.pipeline_helpers import (
    sse_event,
    PipelineTimer,
    validate_duration,
    truncate_json_safely,
    normalize_segments,
    refresh_frame_urls as _refresh_frame_urls,
)

logger = logging.getLogger(__name__)


router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Main Streaming Generator (Intent-Driven Pipeline)
# ─────────────────────────────────────────────────────────────────────────────


async def stream_summarization(
    video_summary_id: str,
    entry: dict[str, Any],
    repository: MongoDBVideoRepository,
    llm_service: LLMService,
) -> AsyncGenerator[str, None]:
    """Intent-driven pipeline: Intent -> Extract -> Enrich -> Synthesize (4-7 LLM calls)."""
    timer = PipelineTimer()

    try:
        youtube_id = entry.get("youtubeId") or entry.get("youtube_id")
        if not youtube_id:
            yield sse_event("error", {"message": "YouTube ID not found"})
            return

        repository.update_status(video_summary_id, ProcessingStatus.PROCESSING)
        logger.info("[pipeline] START video_id=%s youtube_id=%s", video_summary_id, youtube_id)

        # Set video context for LLM usage tracking
        llm_video_id_var.set(youtube_id)

        # Phase 1: Metadata
        llm_feature_var.set("summarize:metadata")
        video_data = await extract_video_data(youtube_id)
        yield sse_event("metadata", {
            "title": video_data.title,
            "channel": video_data.channel,
            "thumbnailUrl": video_data.thumbnail_url,
            "duration": video_data.duration,
        })

        # Validate duration before proceeding
        validate_duration(video_data.duration)

        # Phase 2: Transcript
        llm_feature_var.set("summarize:transcript")
        transcript_data = None
        is_music = (video_data.context.category == "music") if video_data.context else False
        async for item in fetch_transcript(youtube_id, video_data, video_data.duration, is_music=is_music):
            if isinstance(item, str):
                yield item
            else:
                transcript_data = item

        if not transcript_data:
            raise TranscriptError("Failed to fetch transcript", ErrorCode.NO_TRANSCRIPT)

        yield sse_event("transcript_ready", {"duration": video_data.duration})
        clean_text = clean_transcript(transcript_data.raw_text)

        # Phase 2b: SponsorBlock — filter sponsor segments from transcript
        try:
            sponsor_segments = await get_sponsor_segments(youtube_id)
            if sponsor_segments and transcript_data.segments:
                normalized = normalize_segments(transcript_data.segments)
                typed_segments = [TranscriptSegment(**s) for s in normalized]
                filtered = filter_transcript_segments(typed_segments, sponsor_segments)
                if filtered:
                    clean_text = clean_transcript(
                        " ".join(s.text for s in filtered)
                    )
                    logger.info("SponsorBlock: filtered %d sponsor segments", len(sponsor_segments))
        except Exception as e:
            logger.warning("SponsorBlock failed (non-critical): %s", e)

        # Phase 3: Intent Detection + Description Analysis (concurrent)
        llm_feature_var.set("summarize:intent")
        override = check_override(video_summary_id)
        if override:
            category_hint = override.get("category")
        else:
            category_hint = video_data.context.category if video_data.context else None

        intent_task = detect_intent(
            llm_service,
            title=video_data.title,
            description=video_data.description or "",
            duration=video_data.duration or 0,
            category_hint=category_hint,
            transcript_preview=clean_text[:2000],
        )
        desc_task = analyze_description(
            video_data.description or "",
            fast_model=llm_service.fast_model,
        )

        intent, description_analysis = await asyncio.gather(intent_task, desc_task, return_exceptions=True)
        if isinstance(intent, BaseException):
            raise intent  # Intent is critical — re-raise

        yield sse_event("intent_detected", {
            "outputType": intent.output_type,
            "confidence": intent.confidence,
            "userGoal": intent.user_goal,
            "sections": [s.model_dump(by_alias=True) for s in intent.sections],
        })

        if isinstance(description_analysis, DescriptionAnalysis) and description_analysis.has_content:
            yield sse_event("description_analysis", description_analysis.to_dict())

        # Phase 4: Adaptive Extraction
        llm_feature_var.set("summarize:extraction")
        extraction_data = None
        video_info = {
            "title": video_data.title,
            "channel": video_data.channel,
            "duration": video_data.duration,
        }
        async for evt in extract(llm_service, intent.output_type, clean_text, video_info, intent):
            event_name = evt["event"]
            yield sse_event(event_name, {k: v for k, v in evt.items() if k != "event"})
            if event_name == "extraction_complete":
                extraction_data = evt.get("data")

        # Phase 5: Enrichment (conditional)
        llm_feature_var.set("summarize:enrichment")
        enrichment_data = None
        if extraction_data:
            enrichment_result = await enrich(llm_service, intent.output_type, extraction_data, video_data.title)
            if enrichment_result:
                enrichment_data = enrichment_result.model_dump(by_alias=True)
                yield sse_event("enrichment_complete", enrichment_data)

        # Phase 6: Synthesis
        llm_feature_var.set("summarize:synthesis")
        extraction_summary = truncate_json_safely(extraction_data, 4000) if extraction_data else ""
        synthesis_result = await synthesize(
            llm_service,
            title=video_data.title,
            channel=video_data.channel,
            duration=video_data.duration,
            output_type=intent.output_type,
            extraction_summary=extraction_summary,
        )
        yield sse_event("synthesis_complete", {
            "tldr": synthesis_result.tldr,
            "keyTakeaways": synthesis_result.key_takeaways,
            "masterSummary": synthesis_result.master_summary,
            "seoDescription": synthesis_result.seo_description,
        })

        # Save result
        result = {
            "status": ProcessingStatus.COMPLETED.value,
            "title": video_data.title,
            "channel": video_data.channel,
            "thumbnailUrl": video_data.thumbnail_url,
            "duration": video_data.duration,
            "outputType": intent.output_type,
            "intent": intent.model_dump(by_alias=True),
            "output": {"type": intent.output_type, "data": extraction_data},
            "enrichment": enrichment_data,
            "synthesis": synthesis_result.model_dump(by_alias=True),
            "summary": {
                "tldr": synthesis_result.tldr,
                "keyTakeaways": synthesis_result.key_takeaways,
                "masterSummary": synthesis_result.master_summary,
            },
            "processedAt": datetime.now(timezone.utc),
            "processingTimeMs": int(timer.elapsed() * 1000),
        }

        # Include description analysis if available
        if isinstance(description_analysis, DescriptionAnalysis) and description_analysis.has_content:
            result["descriptionAnalysis"] = description_analysis.to_dict()

        repository.save_structured_result(video_summary_id, result)

        processing_time = int(timer.elapsed() * 1000)
        yield sse_event("done", {"videoSummaryId": video_summary_id, "processingTimeMs": processing_time})
        yield "data: [DONE]\n\n"

    except TranscriptError as e:
        logger.info("[pipeline] FAILED video_id=%s error=TranscriptError total=%.1fs", video_summary_id, timer.elapsed())
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        yield sse_event("error", {"message": str(e), "code": e.code.value})

    except RateLimitError as e:
        logger.warning("[pipeline] FAILED video_id=%s error=RateLimitError total=%.1fs", video_summary_id, timer.elapsed())
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.RATE_LIMITED)
        yield sse_event("error", {"message": "AI service rate limited. Please try again in a moment.", "code": ErrorCode.RATE_LIMITED.value})

    except LitellmTimeout as e:
        logger.warning("[pipeline] FAILED video_id=%s error=Timeout total=%.1fs", video_summary_id, timer.elapsed())
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "Request took too long. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except LitellmAPIError as e:
        logger.error("[pipeline] FAILED video_id=%s error=APIError total=%.1fs", video_summary_id, timer.elapsed())
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.LLM_ERROR)
        yield sse_event("error", {"message": "AI service error. Please try again.", "code": ErrorCode.LLM_ERROR.value})

    except Exception as e:
        error_ref = str(uuid.uuid4())[:8]
        logger.error("[pipeline] FAILED video_id=%s error=%s ref=%s total=%.1fs", video_summary_id, type(e).__name__, error_ref, timer.elapsed())
        repository.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.UNKNOWN_ERROR)
        yield sse_event("error", {"message": f"An unexpected error occurred (ref: {error_ref}).", "code": ErrorCode.UNKNOWN_ERROR.value})
    finally:
        if video_summary_id:
            clear_override(video_summary_id)


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

    Intent-driven pipeline delivers content in phases:
    1. INSTANT (~1 sec): Metadata from yt-dlp
    2. TRANSCRIPT: Fetch and clean transcript
    3. INTENT: Detect output type and sections
    4. EXTRACTION: Adaptive structured extraction (1-3 calls)
    5. ENRICHMENT: Quiz/flashcards/cheat sheet (conditional)
    6. SYNTHESIS: TLDR, takeaways, master summary
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
        # Detect format: new pipeline stores "output.type" field, legacy stores "summary.chapters"
        output_field = entry.get("output")
        is_structured = (
            (isinstance(output_field, dict) and "type" in output_field)
            or entry.get("pipelineVersion") == "2.0"
        )
        streamer = _stream_cached_structured if is_structured else _stream_cached_result
        return StreamingResponse(
            streamer(video_summary_id, entry),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    # Always use the new pipeline for fresh summarizations
    return StreamingResponse(
        stream_summarization(video_summary_id, entry, repository, llm_service),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


async def _stream_cached_result(video_summary_id: str, entry: dict[str, Any]) -> AsyncGenerator[str, None]:
    """Stream a legacy cached result as SSE events."""
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


async def _stream_cached_structured(video_summary_id: str, entry: dict[str, Any]) -> AsyncGenerator[str, None]:
    """Stream a cached structured result as SSE events."""
    yield sse_event("cached", {"videoSummaryId": video_summary_id})
    yield sse_event("metadata", {
        "title": entry.get("title"),
        "channel": entry.get("channel"),
        "thumbnailUrl": entry.get("thumbnailUrl") or entry.get("thumbnail_url"),
        "duration": entry.get("duration"),
    })

    if intent := entry.get("intent"):
        # Re-apply canonical sections to fix stale tab IDs from older cached results
        output_type = intent.get("outputType") or (entry.get("output", {}) or {}).get("type")
        if output_type:
            canonical = get_canonical_sections(output_type)
            intent["sections"] = [s.model_dump(by_alias=True) for s in canonical]
        yield sse_event("intent_detected", intent)

    if output := entry.get("output"):
        yield sse_event("extraction_complete", {
            "outputType": output.get("type"),
            "data": output.get("data"),
        })

    if enrichment := entry.get("enrichment"):
        yield sse_event("enrichment_complete", enrichment)

    synthesis = entry.get("synthesis", {})
    summary = entry.get("summary", {})
    yield sse_event("synthesis_complete", {
        "tldr": synthesis.get("tldr") or summary.get("tldr", ""),
        "keyTakeaways": synthesis.get("keyTakeaways") or summary.get("keyTakeaways", []),
        "masterSummary": synthesis.get("masterSummary") or summary.get("masterSummary", ""),
        "seoDescription": synthesis.get("seoDescription", ""),
    })

    yield sse_event("done", {"videoSummaryId": video_summary_id, "cached": True})
    yield "data: [DONE]\n\n"


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

    entry = repository.get_video_summary(video_summary_id)
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

    repository.update_status(video_summary_id, ProcessingStatus.PENDING)

    return RegenerateResponse(
        status="ready",
        video_summary_id=video_summary_id,
        message="Video summary ready for regeneration. Connect to streaming endpoint to process.",
        has_raw_transcript=has_raw_transcript,
        generation=entry.get("generation"),
    )
