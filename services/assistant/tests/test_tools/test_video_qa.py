"""Tests for the video Q&A tool."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.exceptions import LLMError
from src.models.responses import RAGSource
from src.repositories.video_repository import VideoContext
from src.tools.video_qa import VideoQATool


def _make_video_ctx(**overrides) -> VideoContext:
    defaults = {
        "id": "vid1",
        "youtube_id": "yt1",
        "title": "Intro to Transformers",
        "creator": "AI Channel",
        "summary": "A video about transformer architecture.",
        "takeaways": ["Attention is all you need"],
        "tabs": [],
        "output_data": None,
    }
    defaults.update(overrides)
    return VideoContext(**defaults)


def _make_rag_sources(count: int = 2) -> list[RAGSource]:
    pool = [
        RAGSource(text="Self-attention computes weights.", video_id="abc123", timestamp="1:23", score=0.95, chunk_index=0),
        RAGSource(text="The encoder processes input tokens.", video_id="abc123", timestamp="3:10", score=0.88, chunk_index=1),
        RAGSource(text="Positional encoding adds order.", video_id="abc123", timestamp=None, score=0.80, chunk_index=2),
    ]
    return pool[:count]


class TestVideoQA:
    """Video Q&A tool tests."""

    async def test_should_return_answer_with_sources(self) -> None:
        """Should return an answer string and a list of sources from RAG."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = _make_rag_sources(2)
        llm = AsyncMock()
        llm.complete_with_messages.return_value = "Transformers use self-attention."

        tool = VideoQATool(rag=rag, llm=llm)
        params = {"query": "How do transformers work?", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["answer"] == "Transformers use self-attention."
        assert len(result["sources"]) == 2
        assert result["sources"][0]["text"] == "Self-attention computes weights."
        assert result["sources"][0]["score"] == 0.95

    async def test_should_handle_empty_rag_results(self) -> None:
        """Should still produce an answer when RAG returns no chunks."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = []
        llm = AsyncMock()
        llm.complete_with_messages.return_value = "I couldn't find relevant context."

        tool = VideoQATool(rag=rag, llm=llm)
        params = {"query": "What about quantum computing?", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["answer"] == "I couldn't find relevant context."
        assert result["sources"] == []
        # Verify the system prompt includes the "no context" fallback text
        call_args = llm.complete_with_messages.call_args
        system_content = call_args.kwargs["messages"][0]["content"]
        assert "No relevant transcript chunks found" in system_content

    async def test_should_include_timestamps_in_answer(self) -> None:
        """Should pass timestamp-bearing sources to the LLM prompt context."""
        # Arrange
        sources = _make_rag_sources(2)
        rag = AsyncMock()
        rag.search.return_value = sources
        llm = AsyncMock()
        llm.complete_with_messages.return_value = "At [1:23] self-attention is introduced."

        tool = VideoQATool(rag=rag, llm=llm)
        params = {"query": "When is attention discussed?", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["sources"][0]["timestamp"] == "1:23"
        assert result["sources"][1]["timestamp"] == "3:10"
        # The formatted context sent to LLM should contain timestamp prefixes
        call_args = llm.complete_with_messages.call_args
        system_content = call_args.kwargs["messages"][0]["content"]
        assert "[1:23]" in system_content
        assert "[3:10]" in system_content

    async def test_should_search_rag_with_youtube_id_not_mongo_id(self) -> None:
        """Should search Qdrant by the YouTube ID, not the Mongo _id passed in params."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = _make_rag_sources(1)
        llm = AsyncMock()
        llm.complete_with_messages.return_value = "Answer."

        tool = VideoQATool(rag=rag, llm=llm)
        params = {"query": "How do transformers work?", "video_id": "vid1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        await tool.execute(params, context)

        # Assert
        assert rag.search.await_args.kwargs["video_id"] == "yt1"

    async def test_should_raise_on_llm_failure(self) -> None:
        """Should propagate LLMError when the LLM provider fails."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = _make_rag_sources(1)
        llm = AsyncMock()
        llm.complete_with_messages.side_effect = LLMError("provider timeout")

        tool = VideoQATool(rag=rag, llm=llm)
        params = {"query": "Explain attention", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act & Assert
        with pytest.raises(LLMError, match="provider timeout"):
            await tool.execute(params, context)
