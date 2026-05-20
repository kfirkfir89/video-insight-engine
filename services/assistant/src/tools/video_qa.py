"""Video Q&A tool — uses RAG + LLM to answer questions with citations."""

from __future__ import annotations

from src.exceptions import LLMError
from src.logging_config import get_logger
from src.models.responses import RAGSource
from src.repositories.video_repository import VideoContext
from src.services.llm_provider import LLMProvider
from src.services.rag import RAGService

logger = get_logger(__name__)

_QA_SYSTEM_PROMPT = """\
You are a helpful video assistant. Answer the user's question using ONLY \
the transcript context provided below. Include timestamp references where relevant.

Video: {title} by {creator}

Transcript context:
{context}

Rules:
- If the answer is not in the context, say so honestly.
- Reference timestamps in [MM:SS] format when possible.
- Keep answers concise and focused."""

_MAX_CONTEXT_CHUNKS = 8


class VideoQATool:
    """Answer questions about a video using RAG transcript search."""

    name = "video_qa"
    description = "Answer questions about the video using transcript context"

    def __init__(self, rag: RAGService, llm: LLMProvider) -> None:
        self._rag = rag
        self._llm = llm

    async def execute(self, params: dict, context: dict) -> dict:
        """Answer a question using RAG-retrieved transcript chunks.

        Args:
            params: Must contain ``query`` (str) and ``video_id`` (str).
            context: Must contain ``video_ctx`` (VideoContext).

        Returns:
            Dict with ``answer`` and ``sources`` list.
        """
        query: str = params["query"]
        video_id: str = params["video_id"]
        video_ctx: VideoContext = context["video_ctx"]

        logger.info("video_qa_start", video_id=video_id, query=query[:80])

        rag_sources = await self._rag.search(
            query=query,
            video_id=video_id,
            top_k=_MAX_CONTEXT_CHUNKS,
        )

        context_text = _format_rag_context(rag_sources)
        system_prompt = _QA_SYSTEM_PROMPT.format(
            title=video_ctx.title,
            creator=video_ctx.creator or "Unknown",
            context=context_text,
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        try:
            answer = await self._llm.complete_with_messages(
                messages=messages,
                max_tokens=1500,
                span_name="tool:video_qa",
            )
        except LLMError:
            logger.exception("video_qa_llm_failed", video_id=video_id)
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
            "video_qa_complete",
            video_id=video_id,
            sources_count=len(sources),
        )
        return {"answer": answer, "sources": sources}


def _format_rag_context(sources: list[RAGSource]) -> str:
    """Format RAG sources into a single context string."""
    if not sources:
        return "(No relevant transcript chunks found.)"
    lines: list[str] = []
    for src in sources:
        prefix = f"[{src.timestamp}] " if src.timestamp else ""
        lines.append(f"{prefix}{src.text}")
    return "\n\n".join(lines)
