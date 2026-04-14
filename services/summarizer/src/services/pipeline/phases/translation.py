"""Phase 8: Translation — translate assembled output for non-English videos."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any, AsyncGenerator

from src.services.pipeline.pipeline_helpers import sse_event
from src.services.pipeline.translation import translate_assembled_output

if TYPE_CHECKING:
    from src.repositories.mongodb_repository import MongoDBVideoRepository
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


async def run_phase_translation(
    ctx: PipelineContext,
    repository: MongoDBVideoRepository,
    video_summary_id: str,
) -> AsyncGenerator[str, None]:
    """Translate assembled output to English for non-English videos.

    Populates ctx.tabs_en, ctx.meta_en, ctx.synthesis_en and saves to MongoDB.
    Also reverse-translates English UI labels to the video's language (mutates ctx.assembled_tabs).
    """
    if ctx.language == "en":
        return

    yield sse_event("phase", {"phase": "translation"})

    assembled_tabs = ctx.assembled_tabs or []
    meta_dict = ctx.assembled_meta or {}

    tabs_en, meta_en, synthesis_en = await translate_assembled_output(
        ctx.llm_service,
        tabs=assembled_tabs,
        meta=meta_dict,
        synthesis=ctx.synthesis_dict,
        source_language=ctx.language,
    )
    ctx.tabs_en = tabs_en
    ctx.meta_en = meta_en
    ctx.synthesis_en = synthesis_en

    # Save translated fields + mutated original tabs to MongoDB
    translation_update: dict[str, Any] = {}
    if ctx.tabs_en is not None:
        translation_update["tabs_en"] = ctx.tabs_en
    if ctx.meta_en is not None:
        translation_update["meta_en"] = ctx.meta_en
    if ctx.synthesis_en is not None:
        translation_update["synthesis_en"] = ctx.synthesis_en
    # Original tabs were mutated in-place with translated labels
    if ctx.assembled_tabs is not None:
        translation_update["tabs"] = ctx.assembled_tabs
    if translation_update:
        await asyncio.to_thread(
            repository.save_structured_result,
            video_summary_id,
            translation_update,
        )

    logger.info("[pipeline] Translation complete for language=%s", ctx.language)
