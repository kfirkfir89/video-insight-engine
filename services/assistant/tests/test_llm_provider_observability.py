"""Tests for the Langfuse instrumentation wired into LLMProvider.

Covers the symmetry between ``complete_with_messages`` and
``stream_with_messages``: both must emit a generation log when called with
``span_name`` and both must swallow Langfuse failures.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.services import llm_provider as lp
from src.services.llm_provider import LLMProvider, _safe_completion_cost


def _make_stream_response(chunks):
    """Return an async iterator that yields the given chunk objects."""

    class _Stream:
        def __init__(self, items):
            self._items = list(items)

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self._items:
                raise StopAsyncIteration
            return self._items.pop(0)

    return _Stream(chunks)


def _delta_chunk(content: str, finish_reason: str | None = None):
    return SimpleNamespace(
        choices=[SimpleNamespace(
            delta=SimpleNamespace(content=content),
            finish_reason=finish_reason,
        )],
        usage=None,
    )


def _usage_chunk(prompt_tokens: int, completion_tokens: int):
    return SimpleNamespace(
        choices=[],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        ),
    )


class TestSafeCompletionCost:
    """_safe_completion_cost never raises, even when litellm does."""

    def test_should_return_zero_when_no_inputs(self):
        assert _safe_completion_cost() == 0.0

    def test_should_swallow_litellm_exceptions(self, monkeypatch):
        def _boom(**_kwargs):
            raise RuntimeError("unknown model")

        monkeypatch.setattr(lp, "completion_cost", _boom)
        result = _safe_completion_cost(
            model="anthropic/unknown", prompt_tokens=10, completion_tokens=5,
        )
        assert result == 0.0

    def test_should_return_numeric_cost_when_litellm_returns_one(self, monkeypatch):
        monkeypatch.setattr(lp, "completion_cost", lambda **_kw: 0.0042)
        result = _safe_completion_cost(
            model="anthropic/x", prompt_tokens=10, completion_tokens=5,
        )
        assert result == pytest.approx(0.0042)

    def test_should_return_zero_when_litellm_returns_none(self, monkeypatch):
        monkeypatch.setattr(lp, "completion_cost", lambda **_kw: None)
        result = _safe_completion_cost(
            model="anthropic/x", prompt_tokens=10, completion_tokens=5,
        )
        assert result == 0.0


class TestStreamWithMessagesObservability:
    """stream_with_messages must emit a generation log on success."""

    @pytest.mark.asyncio
    async def test_should_record_generation_when_span_name_set(self, monkeypatch):
        captured_kwargs: dict = {}

        async def _fake_acompletion(**kwargs):
            captured_kwargs.update(kwargs)
            return _make_stream_response([
                _delta_chunk("Hello", finish_reason=None),
                _delta_chunk(" world", finish_reason="stop"),
                _usage_chunk(prompt_tokens=12, completion_tokens=3),
            ])

        log_mock = MagicMock()
        monkeypatch.setattr(lp, "acompletion", _fake_acompletion)
        monkeypatch.setattr(lp, "log_generation", log_mock)
        monkeypatch.setattr(lp, "completion_cost", lambda **_kw: 0.0)

        provider = LLMProvider(model="anthropic/claude-sonnet-4-6")
        tokens: list[str] = []
        async for tok in provider.stream_with_messages(
            messages=[{"role": "user", "content": "hi"}],
            span_name="rag_generation",
            span_metadata={"sourcesCount": 2},
        ):
            tokens.append(tok)

        assert tokens == ["Hello", " world"]
        # OpenAI/compatible providers need this flag for usage in the final chunk
        assert captured_kwargs.get("stream_options") == {"include_usage": True}
        log_mock.assert_called_once()
        kw = log_mock.call_args.kwargs
        assert kw["name"] == "rag_generation"
        assert kw["input_tokens"] == 12
        assert kw["output_tokens"] == 3
        assert kw["output_payload"] == "Hello world"
        assert kw["metadata"]["streamed"] is True
        assert kw["metadata"]["sourcesCount"] == 2
        assert kw["metadata"]["finishReason"] == "stop"

    @pytest.mark.asyncio
    async def test_should_skip_logging_when_no_span_name(self, monkeypatch):
        async def _fake_acompletion(**_kwargs):
            return _make_stream_response([_delta_chunk("ok", finish_reason="stop")])

        log_mock = MagicMock()
        monkeypatch.setattr(lp, "acompletion", _fake_acompletion)
        monkeypatch.setattr(lp, "log_generation", log_mock)

        provider = LLMProvider(model="anthropic/claude-sonnet-4-6")
        async for _ in provider.stream_with_messages(
            messages=[{"role": "user", "content": "hi"}],
        ):
            pass

        log_mock.assert_not_called()

    @pytest.mark.asyncio
    async def test_should_skip_logging_when_stream_raises(self, monkeypatch):
        from litellm.exceptions import RateLimitError

        async def _fake_acompletion(**_kwargs):
            raise RateLimitError(
                message="rate limited",
                model="anthropic/claude-sonnet-4-6",
                llm_provider="anthropic",
            )

        log_mock = MagicMock()
        monkeypatch.setattr(lp, "acompletion", _fake_acompletion)
        monkeypatch.setattr(lp, "log_generation", log_mock)

        provider = LLMProvider(model="anthropic/claude-sonnet-4-6")
        from src.exceptions import LLMError

        with pytest.raises(LLMError):
            async for _ in provider.stream_with_messages(
                messages=[{"role": "user", "content": "hi"}],
                span_name="rag_generation",
            ):
                pass

        log_mock.assert_not_called()
