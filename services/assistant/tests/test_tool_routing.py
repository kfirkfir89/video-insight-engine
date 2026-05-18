"""Tests for ToolRouter — keyword intent detection and dispatch."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.exceptions import AppError
from src.models.responses import ChatEvent
from src.services.tool_router import ToolRouter


class _StubTool:
    def __init__(self, name: str, result: dict | None = None, raises: Exception | None = None) -> None:
        self.name = name
        self.description = "stub"
        self._raises = raises
        self.execute = AsyncMock()
        if raises is not None:
            self.execute.side_effect = raises
        else:
            self.execute.return_value = result or {"ok": True}


class TestIntentDetection:
    """ToolRouter.detect_intent — keyword match returns tool name or None."""

    def test_should_detect_note_taker_intent(self):
        router = ToolRouter()
        router.register(_StubTool("note_taker"))
        assert router.detect_intent("Please save note for later") == "note_taker"

    def test_should_detect_quiz_intent(self):
        router = ToolRouter()
        router.register(_StubTool("quiz_generator"))
        assert router.detect_intent("Quiz me on this video") == "quiz_generator"

    def test_should_detect_concept_explain_intent(self):
        router = ToolRouter()
        router.register(_StubTool("concept_explain"))
        assert router.detect_intent("What is a transformer?") == "concept_explain"

    def test_should_detect_navigator_intent(self):
        router = ToolRouter()
        router.register(_StubTool("navigator"))
        assert router.detect_intent("Jump to the part about gradients") == "navigator"

    def test_should_detect_cross_reference_intent(self):
        router = ToolRouter()
        router.register(_StubTool("cross_reference"))
        assert router.detect_intent("Compare with the other video") == "cross_reference"

    def test_should_return_none_for_default_chat(self):
        router = ToolRouter()
        router.register(_StubTool("note_taker"))
        assert router.detect_intent("Tell me about the video") is None

    def test_should_skip_unregistered_tools(self):
        router = ToolRouter()
        # No tools registered — keyword exists in patterns but tool isn't available.
        assert router.detect_intent("save note for me") is None

    def test_should_match_first_pattern_when_two_could_apply(self):
        router = ToolRouter()
        router.register(_StubTool("note_taker"))
        router.register(_StubTool("quiz_generator"))
        # "save note ... quiz me" — note_taker comes first in _INTENT_PATTERNS.
        assert router.detect_intent("Save note then quiz me") == "note_taker"

    def test_should_be_case_insensitive(self):
        router = ToolRouter()
        router.register(_StubTool("quiz_generator"))
        assert router.detect_intent("QUIZ ME on this") == "quiz_generator"


class TestRouteDispatch:
    """ToolRouter.route — yields ChatEvents for the dispatched tool."""

    async def test_should_yield_tool_result_and_done(self, sample_video_context):
        router = ToolRouter()
        router.register(_StubTool("navigator", result={"matches": []}))

        events: list[ChatEvent] = []
        async for event in router.route(
            "navigator", "find something", "vid1", sample_video_context,
        ):
            events.append(event)

        types = [e.type for e in events]
        assert types == ["tool_result", "done"]
        assert events[0].metadata is not None
        assert events[0].metadata["tool"] == "navigator"

    async def test_should_yield_error_when_tool_missing(self, sample_video_context):
        router = ToolRouter()
        # Don't register anything

        events: list[ChatEvent] = []
        async for event in router.route(
            "nonexistent", "msg", "vid1", sample_video_context,
        ):
            events.append(event)

        types = [e.type for e in events]
        assert "error" in types
        assert types[-1] == "done"

    async def test_should_yield_error_for_app_error(self, sample_video_context):
        router = ToolRouter()
        router.register(
            _StubTool("note_taker", raises=AppError("validation failed", status_code=400, code="VALIDATION_ERROR"))
        )

        events: list[ChatEvent] = []
        async for event in router.route(
            "note_taker", "save note xyz", "vid1", sample_video_context,
        ):
            events.append(event)

        errors = [e for e in events if e.type == "error"]
        assert len(errors) == 1
        assert "validation failed" in errors[0].content

    async def test_should_yield_generic_error_for_unexpected_exception(self, sample_video_context):
        router = ToolRouter()
        router.register(_StubTool("note_taker", raises=RuntimeError("boom")))

        events: list[ChatEvent] = []
        async for event in router.route(
            "note_taker", "save note", "vid1", sample_video_context,
        ):
            events.append(event)

        errors = [e for e in events if e.type == "error"]
        assert len(errors) == 1
        assert "encountered an error" in errors[0].content


class TestParamShaping:
    """_build_tool_params maps the raw user message to tool-specific kwargs."""

    @pytest.mark.parametrize(
        ("tool_name", "expected_keys"),
        [
            ("note_taker", {"text"}),
            ("quiz_generator", {"topic"}),
            ("concept_explain", {"concept", "video_id"}),
            ("navigator", {"query"}),
            ("cross_reference", {"query", "video_ids"}),
        ],
    )
    def test_should_shape_params_for_each_tool(self, tool_name, expected_keys):
        from src.services.tool_router import _build_tool_params
        params = _build_tool_params(tool_name, "the message", "vid1")
        assert set(params.keys()) == expected_keys
