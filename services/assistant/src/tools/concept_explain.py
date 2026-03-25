"""Concept explanation tool — deep explanations using Sonnet model."""

from __future__ import annotations

from src.exceptions import LLMError
from src.logging_config import get_logger
from src.models.responses import RAGSource
from src.repositories.video_repository import VideoContext
from src.services.llm_provider import LLMProvider
from src.services.rag import RAGService

logger = get_logger(__name__)

_EXPLAIN_SYSTEM_PROMPT = """\
You are an expert educator explaining concepts from a video.

Video: {title} by {creator}

Relevant transcript context:
{context}

Instructions:
- Provide a clear, thorough explanation of the concept.
- Use examples from the video when available.
- Break down complex ideas into digestible parts.
- Reference timestamps in [MM:SS] format where relevant.
- If the concept is not covered in the video, explain it generally \
and note it was not directly discussed."""

_MAX_CONTEXT_CHUNKS = 6


class ConceptExplainTool:
    """Provide detailed explanations of concepts from the video."""

    name = "concept_explain"
    description = "Provide detailed explanations of concepts from the video"

    def __init__(self, rag: RAGService, llm: LLMProvider) -> None:
        self._rag = rag
        self._llm = llm

    async def execute(self, params: dict, context: dict) -> dict:
        """Explain a concept using RAG context and the default (Sonnet) model.

        Args:
            params: Must contain ``concept`` (str) and ``video_id`` (str).
            context: Must contain ``video_ctx`` (VideoContext).

        Returns:
            Dict with ``explanation`` and ``sources`` list.
        """
        concept: str = params["concept"]
        video_id: str = params["video_id"]
        video_ctx: VideoContext = context["video_ctx"]

        logger.info("concept_explain_start", video_id=video_id, concept=concept[:80])

        rag_sources = await self._rag.search(
            query=concept,
            video_id=video_id,
            top_k=_MAX_CONTEXT_CHUNKS,
        )

        context_text = _format_rag_context(rag_sources)
        system_prompt = _EXPLAIN_SYSTEM_PROMPT.format(
            title=video_ctx.title,
            creator=video_ctx.creator or "Unknown",
            context=context_text,
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Explain this concept: {concept}"},
        ]

        try:
            explanation = await self._llm.complete_with_messages(
                messages=messages,
                max_tokens=2000,
            )
        except LLMError:
            logger.exception("concept_explain_llm_failed", video_id=video_id)
            raise

        sources = [
            {
                "text": s.text,
                "timestamp": s.timestamp,
                "score": s.score,
            }
            for s in rag_sources
        ]

        logger.info(
            "concept_explain_complete",
            video_id=video_id,
            sources_count=len(sources),
        )
        return {"explanation": explanation, "sources": sources}


def _format_rag_context(sources: list[RAGSource]) -> str:
    """Format RAG sources into a single context string."""
    if not sources:
        return "(No relevant transcript context found.)"
    lines: list[str] = []
    for src in sources:
        prefix = f"[{src.timestamp}] " if src.timestamp else ""
        lines.append(f"{prefix}{src.text}")
    return "\n\n".join(lines)
