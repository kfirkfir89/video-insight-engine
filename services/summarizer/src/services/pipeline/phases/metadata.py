"""Phase 1: Metadata — extract video data, description analysis, and validate duration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, AsyncGenerator

from llm_common.context import llm_feature_var

from src.config import settings
from src.services.pipeline.pipeline_helpers import sse_event, validate_duration
from src.services.video.description_analyzer import analyze_description, DescriptionAnalysis

if TYPE_CHECKING:
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def run_phase_metadata(ctx: PipelineContext) -> AsyncGenerator[str, None]:
    """Extract video metadata, run description analysis, and validate duration."""
    from src.services.video.youtube import extract_video_data

    llm_feature_var.set("summarize:metadata")
    ctx.video_data = await extract_video_data(ctx.youtube_id)
    yield sse_event("metadata", {
        "title": ctx.video_data.title,
        "channel": ctx.video_data.channel,
        "thumbnailUrl": ctx.video_data.thumbnail_url,
        "duration": ctx.video_data.duration,
    })
    validate_duration(ctx.video_data.duration)

    # Description analysis — runs here since description is available from video_data
    # Non-blocking: stores result for plan phase and SSE emission
    try:
        description_analysis = await analyze_description(
            ctx.video_data.description or "",
            fast_model=(
                settings.get_stage_model("description_analysis")
                or ctx.llm_service.fast_model
            ),
        )
        ctx.description_analysis = description_analysis
        if isinstance(description_analysis, DescriptionAnalysis) and description_analysis.has_content:
            yield sse_event("description_analysis", description_analysis.to_dict())
    except Exception as e:
        logger.warning("Description analysis failed (non-critical): %s", e)
        ctx.description_analysis = None
