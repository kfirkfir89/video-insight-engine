"""Phase 2a: Transcript — fetch, clean, SponsorBlock filter."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, AsyncGenerator

from llm_common.context import llm_feature_var

from src.config import settings
from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode
from src.services.pipeline.pipeline_helpers import (
    sse_event,
    normalize_segments,
)
from src.services.transcription.transcript import clean_transcript
from src.services.transcription.transcript_fetcher import fetch_transcript
from src.services.transcript.cleaner import clean_transcript_advanced
from src.services.video.sponsorblock import get_sponsor_segments, filter_transcript_segments
from src.utils.worker_pool import run_in_pool

if TYPE_CHECKING:
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def run_phase_transcript(ctx: PipelineContext) -> AsyncGenerator[str, None]:
    """Fetch transcript, clean it, and apply SponsorBlock filtering."""
    llm_feature_var.set("summarize:transcript")
    video_data = ctx.video_data
    assert video_data is not None

    is_music = (video_data.context.category == "music") if video_data.context else False

    # Fetch transcript
    transcript_data = None
    async for item in fetch_transcript(ctx.youtube_id, video_data, video_data.duration, is_music=is_music):
        if isinstance(item, str):
            yield item
        else:
            transcript_data = item

    if not transcript_data:
        raise TranscriptError("Failed to fetch transcript", ErrorCode.NO_TRANSCRIPT)

    ctx.transcript_data = transcript_data

    # Propagate detected language to pipeline context
    if transcript_data.language:
        from src.utils.language_utils import is_rtl
        ctx.language = transcript_data.language
        ctx.is_rtl = is_rtl(transcript_data.language)
        logger.info("Pipeline language set: %s (RTL: %s)", ctx.language, ctx.is_rtl)

    # Sound-only detection: a music-category video with essentially no speech
    # means Whisper hallucinated a language on instrumental audio. Force English
    # so downstream prompts produce coherent output instead of fabricated
    # foreign-language content.
    from src.utils.language_utils import is_sound_only_video
    raw_text = transcript_data.raw_text or ""
    if is_sound_only_video(
        is_music=is_music,
        language=ctx.language,
        raw_text=raw_text,
        duration=video_data.duration or 0,
        wps_threshold=settings.MUSIC_LANGUAGE_FORCE_EN_WPS,
    ):
        logger.warning(
            "Sound-only music video detected; overriding language %r -> en "
            "(word_count=%d, duration=%ds)",
            ctx.language, len(raw_text.split()), video_data.duration or 0,
        )
        ctx.language = "en"
        ctx.is_rtl = False
        ctx.force_english_reason = "sound_only"

    yield sse_event("transcript_ready", {"duration": video_data.duration})
    ctx.clean_text = clean_transcript(transcript_data.raw_text)

    # Advanced cleaning (spaCy + TF-IDF)
    if settings.TRANSCRIPT_CLEANING_ENABLED:
        try:
            ctx.clean_text = await asyncio.wait_for(
                run_in_pool(clean_transcript_advanced, ctx.clean_text),
                timeout=30.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Advanced transcript cleaning timed out (30s), using basic cleaning")
        except Exception as e:
            logger.warning("Advanced transcript cleaning failed (non-critical): %s", e)

    # SponsorBlock filtering
    try:
        sponsor_segments = await get_sponsor_segments(ctx.youtube_id)
        if sponsor_segments and transcript_data.segments:
            normalized = normalize_segments(transcript_data.segments)
            sb_segments = [
                {"text": s["text"], "start": s["startMs"] / 1000.0, "duration": (s["endMs"] - s["startMs"]) / 1000.0}
                for s in normalized
            ]
            filtered = filter_transcript_segments(sb_segments, sponsor_segments)
            if filtered:
                ctx.clean_text = clean_transcript(
                    " ".join(s["text"] for s in filtered)
                )
                logger.info("SponsorBlock: filtered %d sponsor segments", len(sponsor_segments))
    except (TypeError, ValueError, KeyError) as e:
        logger.warning("SponsorBlock filtering failed (non-critical): %s - %s", type(e).__name__, e)
    except (OSError, TimeoutError) as e:
        logger.error("SponsorBlock network error: %s - %s", type(e).__name__, e)
