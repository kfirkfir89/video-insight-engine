"""Cross-reference tool — compare content across multiple videos."""

from __future__ import annotations

import asyncio

from src.exceptions import LLMError, ValidationError
from src.logging_config import get_logger
from src.repositories.qdrant_repository import QdrantRepository
from src.services.llm_provider import LLMProvider
from src.services.rag import RAGService

logger = get_logger(__name__)

_COMPARE_SYSTEM_PROMPT = """\
You are comparing content across multiple videos based on a user query.

For each video, you have relevant transcript excerpts below. \
Compare and contrast what each video says about the topic.

{video_sections}

Instructions:
- Highlight agreements and disagreements between videos.
- Note unique insights from each video.
- Reference which video said what.
- Keep the comparison concise and structured."""

_MAX_VIDEOS = 5
_CHUNKS_PER_VIDEO = 4


class CrossReferenceTool:
    """Compare content across multiple videos."""

    name = "cross_reference"
    description = "Compare content across multiple videos"

    def __init__(self, rag: RAGService, llm: LLMProvider) -> None:
        self._rag = rag
        self._llm = llm

    async def execute(self, params: dict, context: dict) -> dict:
        """Search across multiple videos and compare results.

        Args:
            params: Must contain ``query`` (str) and ``video_ids`` (list[str]).
            context: Unused for cross-reference.

        Returns:
            Dict with ``comparison`` (str) and ``video_sources`` (dict).

        Raises:
            ValidationError: If video_ids list is empty or too large.
        """
        query: str = params["query"]
        video_ids: list[str] = params.get("video_ids", [])

        if not video_ids:
            raise ValidationError("At least one video ID is required")
        if len(video_ids) > _MAX_VIDEOS:
            raise ValidationError(f"Maximum {_MAX_VIDEOS} videos for comparison")

        logger.info(
            "cross_reference_start",
            query=query[:80],
            video_count=len(video_ids),
        )

        # Search all videos in parallel
        search_tasks = [
            self._rag.search(
                query=query,
                video_id=vid,
                top_k=_CHUNKS_PER_VIDEO,
            )
            for vid in video_ids
        ]
        all_results = await asyncio.gather(*search_tasks)

        # Build per-video source mapping
        video_sources: dict[str, list[dict]] = {}
        video_sections: list[str] = []

        for vid, sources in zip(video_ids, all_results):
            video_sources[vid] = [
                {"text": s.text, "timestamp": s.timestamp, "score": s.score}
                for s in sources
            ]
            if sources:
                chunks = "\n".join(
                    f"[{s.timestamp or '?'}] {s.text}" for s in sources
                )
                video_sections.append(f"--- Video {vid} ---\n{chunks}")

        if not video_sections:
            return {
                "comparison": "No relevant content found across the specified videos.",
                "video_sources": video_sources,
            }

        system_prompt = _COMPARE_SYSTEM_PROMPT.format(
            video_sections="\n\n".join(video_sections),
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        try:
            comparison = await self._llm.complete_with_messages(
                messages=messages,
                max_tokens=2000,
            )
        except LLMError:
            logger.exception("cross_reference_llm_failed")
            raise

        logger.info(
            "cross_reference_complete",
            video_count=len(video_ids),
            total_sources=sum(len(s) for s in video_sources.values()),
        )
        return {"comparison": comparison, "video_sources": video_sources}
