"""Phase 8: Translation — promote English to primary for non-English videos.

Calls ``translate_to_source`` which walks the assembled output, translates
every translatable prose string in one Haiku call, and returns an
English-primary dict with the original-language artifact nested under
``sourceLanguage``. On any failure (LLM error, mirror, length mismatch),
the returned dict has no ``sourceLanguage`` key and the phase no-ops —
the FE then simply renders no language toggle.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, AsyncGenerator

from src.config import settings
from src.services.cache.response_cache import response_cache
from src.services.pipeline.pipeline_helpers import sse_event
from src.services.pipeline.translation import translate_to_source
from src.services.vector.store import store_default_output_chunks

if TYPE_CHECKING:
    from src.repositories.mongodb_repository import MongoDBVideoRepository
    from src.services.pipeline.context import PipelineContext

logger = logging.getLogger(__name__)


def _log_qdrant_error(t: asyncio.Task) -> None:
    if t.cancelled():
        return
    exc = t.exception()
    if exc:
        logger.error("Qdrant store failed: %s", exc)


async def run_phase_translation(
    ctx: PipelineContext,
    repository: MongoDBVideoRepository,
    video_summary_id: str,
) -> AsyncGenerator[str, None]:
    """Translate assembled output and swap English to primary on ctx."""
    if ctx.language == "en":
        return

    yield sse_event("phase", {"phase": "translation"})

    # `meta` is a superset of synthesis (carries tldr/masterSummary/
    # keyTakeaways/seoDescription). Sending synthesis through translation
    # would duplicate work; the FE reconstructs synthesis from meta via
    # buildSynthesisFromMeta. Top-level synthesis is no longer persisted.
    output = {
        "tabs": ctx.assembled_tabs or [],
        "meta": ctx.assembled_meta or {},
    }
    result = await translate_to_source(ctx.llm_service, output, ctx.language)

    if "sourceLanguage" not in result:
        # Failure / no-op — keep source language as primary, no toggle.
        logger.warning(
            "[pipeline] Translation produced no sourceLanguage (lang=%s); "
            "skipping promotion",
            ctx.language,
        )
        return

    # Promote English to primary on ctx so downstream consumers see English.
    ctx.assembled_tabs = result["tabs"]
    ctx.assembled_meta = result["meta"]
    ctx.source_language = result["sourceLanguage"]

    await asyncio.to_thread(
        repository.save_structured_result,
        video_summary_id,
        {
            "tabs": ctx.assembled_tabs,
            "meta": ctx.assembled_meta,
            "sourceLanguage": ctx.source_language,
            "language": "en",
            "isRTL": False,
        },
    )

    logger.info(
        "[pipeline] Translation complete: promoted English to primary, "
        "stashed source=%s under sourceLanguage",
        result["sourceLanguage"]["code"],
    )

    # Now write the final English-primary payload to Redis. Assembly phase
    # intentionally skipped the cache for non-English videos so the
    # source-language tabs never become the cached shape; this write owns
    # the cache for the full TTL and ensures FE cache hits see the toggle.
    if settings.REDIS_ENABLED:
        from src.routes.cached_response import build_frontend_response
        frontend_response = build_frontend_response({
            "status": "completed",
            "youtubeId": ctx.youtube_id,
            "title": ctx.video_data.title if ctx.video_data else None,
            "creator": ctx.video_data.channel if ctx.video_data else None,
            "duration": ctx.video_data.duration if ctx.video_data else None,
            "thumbnailUrl": ctx.video_data.thumbnail_url if ctx.video_data else None,
            "meta": ctx.assembled_meta,
            "tabs": ctx.assembled_tabs,
            "sourceLanguage": ctx.source_language,
            "language": "en",
            "isRTL": False,
        })
        try:
            await response_cache.set_response(ctx.youtube_id, frontend_response)
        except (OSError, ConnectionError) as e:
            logger.debug("Redis cache failed (non-critical): %s", e)

    if settings.QDRANT_ENABLED and ctx.assembled_tabs:
        task = asyncio.create_task(
            store_default_output_chunks(
                ctx.youtube_id, ctx.assembled_tabs, language="en",
            ),
            name=f"store_output_{ctx.youtube_id}",
        )
        task.add_done_callback(_log_qdrant_error)
