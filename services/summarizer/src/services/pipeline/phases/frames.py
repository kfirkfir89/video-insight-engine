"""Phase 2b: Frames — scene extraction, scoring, OCR, vision analysis, presigned URLs.

Runs in parallel with the transcript phase. Both only need youtube_id
and video_data from metadata. Neither depends on the other.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, AsyncGenerator

from llm_common.context import llm_feature_var

from src.config import settings
from src.services.media.scene_extractor import extract_scene_keyframes, cleanup_temp_dir
from src.services.pipeline.scene_frames import process_scene_frames

if TYPE_CHECKING:
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def _run_vision_analysis(ctx: PipelineContext, selected_frames: list[dict]) -> None:
    """Run vision LLM analysis on top frames (non-critical)."""
    if not settings.FRAME_VISION_ENABLED:
        return
    if not selected_frames:
        return

    try:
        from src.services.media.frame_analyzer import analyze_frames_with_vision

        llm_feature_var.set("summarize:frames")
        descriptions = await analyze_frames_with_vision(
            selected_frames,
            ctx.llm_service.provider,
            max_frames=settings.FRAME_VISION_MAX_FRAMES,
            timeout=settings.FRAME_VISION_TIMEOUT,
        )
        ctx.frame_descriptions = descriptions
        logger.info("Vision analysis: %d frame descriptions generated", len(descriptions))
    except Exception as e:
        logger.warning("Vision analysis failed (non-critical): %s", e)


async def run_phase_frames(ctx: PipelineContext) -> AsyncGenerator[str, None]:
    """Extract scene keyframes, score, select, run OCR + vision, and prepare for assembly.

    Downloads lowest-quality video via yt-dlp, runs FFmpeg scene detection,
    scores frames locally, selects ~25 best, uploads to S3, runs OCR
    and vision analysis in parallel, and stores enriched frames on context.
    """
    if not settings.SCENE_EXTRACTION_ENABLED:
        return

    if not ctx.video_data:
        return

    temp_dir = None
    try:
        extraction_result = await extract_scene_keyframes(
            ctx.youtube_id,
            duration_seconds=ctx.video_data.duration,
        )

        all_frames = extraction_result.get("all_frames", [])
        selected_frames = extraction_result.get("selected_frames", [])
        temp_dir = all_frames[0].get("temp_dir") if all_frames else None

        if not all_frames:
            return

        # Run OCR/presigned-URLs and vision analysis in parallel
        # Vision needs local file paths (before cleanup), so it runs here
        ocr_task = process_scene_frames(extraction_result, ctx.youtube_id)
        vision_task = _run_vision_analysis(ctx, selected_frames)

        (enriched_result, event_str, _), _ = await asyncio.gather(
            ocr_task, vision_task,
        )
        yield event_str

        # Store on context for assembly
        ctx.scene_frames_for_assembly = enriched_result.get("selected_frames", [])
        ctx.scene_frames_all = enriched_result.get("all_frames", [])
        ctx.scene_frames_gallery = enriched_result.get("gallery_frames", [])

        logger.info(
            "Frame extraction: %d all, %d selected, %d gallery, %d vision descriptions",
            len(ctx.scene_frames_all),
            len(ctx.scene_frames_for_assembly),
            len(ctx.scene_frames_gallery),
            len(ctx.frame_descriptions),
        )
    except Exception as e:
        logger.warning("Frame extraction failed (non-critical): %s", e)
    finally:
        # Always clean up temp frame files (even on failure)
        if temp_dir:
            await cleanup_temp_dir(temp_dir)
