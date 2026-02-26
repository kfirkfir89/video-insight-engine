"""Concept extraction and master summary generators.

These async generators yield SSE events during processing and produce
their final result as the last yielded item. They are consumed by the
main ``stream_summarization`` orchestrator in ``src.routes.stream``.

Extracted from ``src.routes.stream`` for maintainability.
"""

import logging
from typing import Any, AsyncGenerator

import litellm

from src.services.llm import LLMService, build_concept_dicts
from src.services.pipeline_helpers import sse_event, sse_token
from src.services.youtube import VideoData

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Concept Extraction
# ─────────────────────────────────────────────────────────────────────────────


async def extract_concepts(
    llm_service: LLMService,
    timestamped_transcript: str,
) -> AsyncGenerator[str | list[dict[str, Any]], None]:
    """
    Extract key concepts from transcript.

    Yields SSE events, then yields concepts list.
    """
    yield sse_event("phase", {"phase": "concepts"})

    raw_concepts: list[dict[str, Any]] = []
    async for event_type, data in llm_service.stream_extract_concepts(timestamped_transcript):
        if event_type == "token":
            yield sse_token("concepts", str(data))
        else:
            raw_concepts = data if isinstance(data, list) else []

    logger.debug("Extracted %d concepts", len(raw_concepts))

    concepts = build_concept_dicts(raw_concepts)

    yield sse_event("concepts_complete", {"concepts": concepts})
    yield concepts


# ─────────────────────────────────────────────────────────────────────────────
# Master Summary
# ─────────────────────────────────────────────────────────────────────────────


async def generate_master_summary(
    llm_service: LLMService,
    video_data: VideoData,
    duration: int,
    persona: str,
    synthesis: dict[str, Any],
    chapters: list[dict[str, Any]],
    concepts: list[dict[str, Any]],
) -> AsyncGenerator[str | None, None]:
    """
    Generate master summary. Non-fatal on failure.

    Yields SSE events, then yields the master summary or None.
    """
    yield sse_event("phase", {"phase": "master_summary"})

    try:
        master_summary = await llm_service.generate_master_summary(
            title=video_data.title,
            channel=video_data.channel or "",
            duration=duration,
            persona=persona,
            tldr=synthesis.get("tldr", ""),
            key_takeaways=synthesis.get("keyTakeaways", []),
            chapters=chapters,
            concepts=concepts,
        )
        yield sse_event("master_summary_complete", {"masterSummary": master_summary})
        logger.debug("Master summary generated: %d chars", len(master_summary))
        yield master_summary
    except (litellm.exceptions.RateLimitError, litellm.exceptions.APIConnectionError, TimeoutError) as e:
        logger.warning("Master summary skipped (%s): %s", type(e).__name__, e)
        yield None
    except (litellm.exceptions.AuthenticationError, litellm.exceptions.APIError) as e:
        logger.error("Master summary failed (%s): %s", type(e).__name__, e)
        yield None
