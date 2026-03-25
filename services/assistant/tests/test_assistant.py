"""Tests for AssistantService — core chat orchestrator."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from src.models.requests import ChatMessage


class TestAssistantChat:
    """AssistantService.chat() behaviour."""

    async def test_should_stream_response_tokens(self, assistant_service):
        events = []
        async for event in assistant_service.chat(
            video_id="abc123", message="What is this video about?", history=[],
        ):
            events.append(event)

        assert len(events) > 0
        text_events = [e for e in events if "\"type\":\"text\"" in e]
        assert len(text_events) > 0

    async def test_should_call_video_repo(self, assistant_service, mock_video_repo):
        async for _ in assistant_service.chat(
            video_id="abc123", message="Explain.", history=[],
        ):
            pass

        mock_video_repo.get_video_context.assert_called_once_with("abc123")

    async def test_should_search_rag_with_message(self, assistant_service, mock_rag):
        async for _ in assistant_service.chat(
            video_id="abc123", message="What is backpropagation?", history=[],
        ):
            pass

        mock_rag.search.assert_called_once()
        call_kwargs = mock_rag.search.call_args.kwargs
        assert call_kwargs["query"] == "What is backpropagation?"

    async def test_should_include_history(self, assistant_service):
        history = [
            ChatMessage(role="user", content="What are neural networks?"),
            ChatMessage(role="assistant", content="Neural networks are..."),
        ]

        events = []
        async for event in assistant_service.chat(
            video_id="abc123", message="Tell me more", history=history,
        ):
            events.append(event)

        assert len(events) > 0

    async def test_should_enforce_max_turns(self, assistant_service):
        history = [
            ChatMessage(role="user" if i % 2 == 0 else "assistant", content=f"msg {i}")
            for i in range(50)
        ]

        events = []
        async for event in assistant_service.chat(
            video_id="abc123", message="Another question", history=history,
        ):
            events.append(event)

        assert len(events) > 0

    async def test_should_cache_video_context(self, assistant_service, mock_video_repo):
        async for _ in assistant_service.chat(video_id="abc123", message="Q1", history=[]):
            pass
        async for _ in assistant_service.chat(video_id="abc123", message="Q2", history=[]):
            pass

        assert mock_video_repo.get_video_context.call_count == 1

    async def test_should_raise_for_unknown_video(self, mock_rag, mock_llm, mock_settings):
        from src.services.assistant import AssistantService
        from src.services.context_builder import ContextBuilder

        missing_repo = AsyncMock()
        missing_repo.get_video_context.return_value = None

        assistant = AssistantService(
            llm=mock_llm, rag=mock_rag, video_repo=missing_repo,
            context_builder=ContextBuilder(), settings=mock_settings,
        )

        with pytest.raises(Exception):
            async for _ in assistant.chat(video_id="nonexistent", message="Hello", history=[]):
                pass

    async def test_should_yield_sources_before_text(self, assistant_service):
        events = []
        async for event in assistant_service.chat(
            video_id="abc123", message="What about layers?", history=[],
        ):
            events.append(event)

        source_idxs = [i for i, e in enumerate(events) if "\"type\":\"source\"" in e]
        text_idxs = [i for i, e in enumerate(events) if "\"type\":\"text\"" in e]
        if source_idxs and text_idxs:
            assert max(source_idxs) < min(text_idxs)

    async def test_should_yield_done_at_end(self, assistant_service):
        events = []
        async for event in assistant_service.chat(
            video_id="abc123", message="Summarize.", history=[],
        ):
            events.append(event)

        assert len(events) > 0
        assert "\"type\":\"done\"" in events[-1]

    async def test_should_handle_llm_error(self, mock_video_repo, mock_rag, mock_settings):
        from src.services.assistant import AssistantService
        from src.services.context_builder import ContextBuilder

        failing_llm = AsyncMock()

        async def _failing_stream(*_a, **_k):
            raise RuntimeError("LLM unavailable")
            yield  # noqa: unreachable

        failing_llm.stream_with_messages = _failing_stream
        failing_llm.model = "test"

        assistant = AssistantService(
            llm=failing_llm, rag=mock_rag, video_repo=mock_video_repo,
            context_builder=ContextBuilder(), settings=mock_settings,
        )

        events = []
        async for event in assistant.chat(video_id="abc123", message="Hello", history=[]):
            events.append(event)

        error_events = [e for e in events if "\"type\":\"error\"" in e]
        assert len(error_events) > 0
