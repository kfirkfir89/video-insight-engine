"""Tests for the concept explain tool."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.exceptions import LLMError
from src.models.responses import RAGSource
from src.repositories.video_repository import VideoContext
from src.tools.concept_explain import ConceptExplainTool


def _make_video_ctx() -> VideoContext:
    return VideoContext(
        id="vid1",
        youtube_id="yt1",
        title="Deep Learning Basics",
        creator="AI Academy",
        summary="Covers neural networks and gradient descent.",
        takeaways=["Gradients drive learning"],
        tabs=[],
        output_data=None,
    )


def _make_rag_sources(count: int = 2) -> list[RAGSource]:
    pool = [
        RAGSource(text="Gradient descent updates weights by following the slope.", video_id="abc123", timestamp="2:15", score=0.93, chunk_index=0),
        RAGSource(text="The learning rate controls step size.", video_id="abc123", timestamp="4:00", score=0.85, chunk_index=1),
    ]
    return pool[:count]


class TestConceptExplain:
    """Concept explain tool tests."""

    async def test_should_return_explanation_with_sources(self) -> None:
        """Should return an explanation and the RAG sources used."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = _make_rag_sources(2)
        llm = AsyncMock()
        llm.complete_with_messages.return_value = (
            "Gradient descent is an optimization algorithm that minimizes loss."
        )

        tool = ConceptExplainTool(rag=rag, llm=llm)
        params = {"concept": "gradient descent", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert "Gradient descent" in result["explanation"]
        assert len(result["sources"]) == 2
        assert result["sources"][0]["timestamp"] == "2:15"

    async def test_should_use_default_model_not_fast(self) -> None:
        """Should call the injected LLM (default model) rather than creating a fast one."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = _make_rag_sources(1)
        llm = AsyncMock()
        llm.complete_with_messages.return_value = "Explanation here."

        tool = ConceptExplainTool(rag=rag, llm=llm)
        params = {"concept": "backpropagation", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        await tool.execute(params, context)

        # Assert — the tool uses the injected llm directly (not a new LLMProvider)
        llm.complete_with_messages.assert_awaited_once()
        call_kwargs = llm.complete_with_messages.call_args.kwargs
        assert call_kwargs["max_tokens"] == 2000

    async def test_should_handle_empty_rag_results(self) -> None:
        """Should produce an explanation even when RAG returns no chunks."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = []
        llm = AsyncMock()
        llm.complete_with_messages.return_value = "General explanation without video context."

        tool = ConceptExplainTool(rag=rag, llm=llm)
        params = {"concept": "quantum entanglement", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["explanation"] == "General explanation without video context."
        assert result["sources"] == []
        # System prompt should contain the fallback text
        call_args = llm.complete_with_messages.call_args
        system_content = call_args.kwargs["messages"][0]["content"]
        assert "No relevant transcript context found" in system_content

    async def test_should_raise_on_llm_failure(self) -> None:
        """Should propagate LLMError when the LLM call fails."""
        # Arrange
        rag = AsyncMock()
        rag.search.return_value = _make_rag_sources(1)
        llm = AsyncMock()
        llm.complete_with_messages.side_effect = LLMError("rate limit exceeded")

        tool = ConceptExplainTool(rag=rag, llm=llm)
        params = {"concept": "attention mechanism", "video_id": "yt1"}
        context = {"video_ctx": _make_video_ctx()}

        # Act & Assert
        with pytest.raises(LLMError, match="rate limit exceeded"):
            await tool.execute(params, context)
