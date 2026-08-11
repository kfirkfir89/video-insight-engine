"""Tests for LLMProvider.complete_with_tools — tool-call parsing."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.exceptions import LLMError
from src.services import llm_provider as lp
from src.services.llm_provider import LLMProvider, ToolCompletion, _parse_tool_calls


def _tool_call(call_id: str, name: str, arguments: str):
    return SimpleNamespace(
        id=call_id,
        function=SimpleNamespace(name=name, arguments=arguments),
    )


def _response(*, content=None, tool_calls=None, finish_reason="stop"):
    return SimpleNamespace(
        choices=[SimpleNamespace(
            message=SimpleNamespace(content=content, tool_calls=tool_calls),
            finish_reason=finish_reason,
        )],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
    )


class TestParseToolCalls:
    """_parse_tool_calls normalises LiteLLM tool_calls into plain dicts."""

    def test_should_return_empty_for_none(self) -> None:
        assert _parse_tool_calls(None) == []

    def test_should_return_empty_for_empty_list(self) -> None:
        assert _parse_tool_calls([]) == []

    def test_should_parse_arguments_json(self) -> None:
        calls = _parse_tool_calls([
            _tool_call("c1", "create_folder", '{"name": "Food"}'),
        ])
        assert calls == [
            {"id": "c1", "name": "create_folder", "arguments": {"name": "Food"}},
        ]

    def test_should_default_empty_args_to_dict(self) -> None:
        calls = _parse_tool_calls([_tool_call("c1", "list_folders", "")])
        assert calls[0]["arguments"] == {}

    def test_should_default_invalid_json_to_empty_dict(self) -> None:
        calls = _parse_tool_calls([_tool_call("c1", "list_folders", "not json")])
        assert calls[0]["arguments"] == {}


class TestCompleteWithTools:
    """complete_with_tools calls acompletion with tools + tool_choice=auto."""

    async def test_should_return_tool_calls_when_present(self, monkeypatch) -> None:
        captured = {}

        async def _fake_acompletion(**kwargs):
            captured.update(kwargs)
            return _response(
                content=None,
                tool_calls=[_tool_call("c1", "create_folder", '{"name": "Food"}')],
                finish_reason="tool_calls",
            )

        monkeypatch.setattr(lp, "acompletion", _fake_acompletion)
        provider = LLMProvider(model="anthropic/claude-sonnet-4-6")

        result = await provider.complete_with_tools(
            [{"role": "user", "content": "make a folder"}],
            tools=[{"type": "function", "function": {"name": "create_folder"}}],
        )

        assert isinstance(result, ToolCompletion)
        assert result.content is None
        assert result.tool_calls[0]["name"] == "create_folder"
        assert result.tool_calls[0]["arguments"] == {"name": "Food"}
        assert captured["tool_choice"] == "auto"
        assert captured["tools"]

    async def test_should_return_content_when_no_tool_calls(self, monkeypatch) -> None:
        async def _fake_acompletion(**_kwargs):
            return _response(content="Here is your answer.", tool_calls=None)

        monkeypatch.setattr(lp, "acompletion", _fake_acompletion)
        provider = LLMProvider(model="anthropic/claude-sonnet-4-6")

        result = await provider.complete_with_tools(
            [{"role": "user", "content": "hi"}], tools=[],
        )

        assert result.content == "Here is your answer."
        assert result.tool_calls == []

    async def test_should_raise_llm_error_on_provider_failure(self, monkeypatch) -> None:
        from litellm.exceptions import APIError

        async def _fake_acompletion(**_kwargs):
            raise APIError(
                status_code=500, message="boom", llm_provider="anthropic", model="x",
            )

        monkeypatch.setattr(lp, "acompletion", _fake_acompletion)
        provider = LLMProvider(model="anthropic/claude-sonnet-4-6")

        with pytest.raises(LLMError):
            await provider.complete_with_tools(
                [{"role": "user", "content": "hi"}], tools=[],
            )
