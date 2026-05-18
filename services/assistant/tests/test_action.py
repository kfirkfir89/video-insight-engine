"""Tests for the /action endpoint and ActionDispatcher."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.exceptions import NotFoundError, ValidationError
from src.services.tool_router import (
    ACTION_TO_TOOL,
    ActionDispatcher,
    ToolRouter,
    _build_action_params,
)


class _StubTool:
    def __init__(self, name: str, result: dict) -> None:
        self.name = name
        self.description = "stub"
        self.execute = AsyncMock(return_value=result)


class TestBuildActionParams:
    """_build_action_params input shaping + validation."""

    def test_should_pass_text_for_save_note(self):
        result = _build_action_params("save_note", {"text": "my note"}, "vid1")
        assert result == {"text": "my note"}

    def test_should_include_timestamp_when_present_for_save_note(self):
        result = _build_action_params("save_note", {"text": "n", "timestamp": "1:23"}, "vid1")
        assert result == {"text": "n", "timestamp": "1:23"}

    def test_should_raise_when_save_note_missing_text(self):
        with pytest.raises(ValidationError, match="requires param 'text'"):
            _build_action_params("save_note", {}, "vid1")

    def test_should_raise_when_save_note_text_is_blank(self):
        with pytest.raises(ValidationError, match="requires param 'text'"):
            _build_action_params("save_note", {"text": "   "}, "vid1")

    def test_should_pass_topic_for_quiz_me(self):
        result = _build_action_params("quiz_me", {"topic": "x", "num_questions": 3}, "vid1")
        assert result == {"topic": "x", "num_questions": 3}

    def test_should_allow_quiz_me_with_no_params(self):
        result = _build_action_params("quiz_me", {}, "vid1")
        assert result == {}

    def test_should_pass_query_for_find_moment(self):
        result = _build_action_params("find_moment", {"query": "intro"}, "vid1")
        assert result == {"query": "intro"}

    def test_should_raise_when_find_moment_missing_query(self):
        with pytest.raises(ValidationError, match="requires param 'query'"):
            _build_action_params("find_moment", {}, "vid1")

    def test_should_pass_concept_and_video_id_for_explain(self):
        result = _build_action_params("explain", {"concept": "neurons"}, "vid1")
        assert result == {"concept": "neurons", "video_id": "vid1"}

    def test_should_raise_for_unknown_action(self):
        with pytest.raises(ValidationError, match="Unknown action"):
            _build_action_params("teleport", {}, "vid1")


class TestActionDispatcher:
    """ActionDispatcher.dispatch() — runs the matched tool."""

    async def test_should_dispatch_to_note_taker_for_save_note(self, sample_video_context):
        router = ToolRouter()
        stub = _StubTool("note_taker", {"saved": True, "note_id": "abc"})
        router.register(stub)
        dispatcher = ActionDispatcher(router)

        result = await dispatcher.dispatch(
            action="save_note",
            video_id="vid1",
            params={"text": "remember me"},
            video_ctx=sample_video_context,
            user_id="user42",
        )

        assert result == {"saved": True, "note_id": "abc"}
        stub.execute.assert_awaited_once()
        passed_params, passed_ctx = stub.execute.await_args.args
        assert passed_params == {"text": "remember me"}
        assert passed_ctx["video_id"] == "vid1"
        assert passed_ctx["user_id"] == "user42"

    async def test_should_dispatch_to_quiz_generator_for_quiz_me(self, sample_video_context):
        router = ToolRouter()
        stub = _StubTool("quiz_generator", {"questions": []})
        router.register(stub)
        dispatcher = ActionDispatcher(router)

        result = await dispatcher.dispatch(
            action="quiz_me",
            video_id="vid1",
            params={"topic": "math"},
            video_ctx=sample_video_context,
        )

        assert result == {"questions": []}
        passed_params, _ = stub.execute.await_args.args
        assert passed_params == {"topic": "math"}

    async def test_should_dispatch_to_navigator_for_find_moment(self, sample_video_context):
        router = ToolRouter()
        stub = _StubTool("navigator", {"matches": [{"tab_id": "concepts"}]})
        router.register(stub)
        dispatcher = ActionDispatcher(router)

        result = await dispatcher.dispatch(
            action="find_moment",
            video_id="vid1",
            params={"query": "intro"},
            video_ctx=sample_video_context,
        )

        assert result == {"matches": [{"tab_id": "concepts"}]}

    async def test_should_dispatch_to_concept_explain_for_explain(self, sample_video_context):
        router = ToolRouter()
        stub = _StubTool("concept_explain", {"explanation": "blah", "sources": []})
        router.register(stub)
        dispatcher = ActionDispatcher(router)

        result = await dispatcher.dispatch(
            action="explain",
            video_id="vid1",
            params={"concept": "neurons"},
            video_ctx=sample_video_context,
        )

        assert result["explanation"] == "blah"

    async def test_should_raise_validation_error_when_tool_unregistered(self, sample_video_context):
        router = ToolRouter()
        dispatcher = ActionDispatcher(router)

        with pytest.raises(ValidationError, match="is not available"):
            await dispatcher.dispatch(
                action="save_note",
                video_id="vid1",
                params={"text": "x"},
                video_ctx=sample_video_context,
            )

    async def test_should_raise_validation_error_for_unknown_action(self, sample_video_context):
        router = ToolRouter()
        dispatcher = ActionDispatcher(router)

        with pytest.raises(ValidationError, match="Unknown action"):
            await dispatcher.dispatch(
                action="teleport",
                video_id="vid1",
                params={},
                video_ctx=sample_video_context,
            )


class TestActionEndpoint:
    """POST /action — end-to-end through FastAPI."""

    async def test_should_return_200_with_action_response_envelope(
        self, app_client, mock_settings,
    ):
        from src.server import app

        mock_service = AsyncMock()
        mock_service.dispatch_action.return_value = {"saved": True, "note_id": "n1"}
        app.state.assistant_service = mock_service

        response = await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "save_note", "params": {"text": "hi"}},
            headers={"X-User-Id": "user1", "X-Internal-Secret": "dev-internal-secret-change-me"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["action"] == "save_note"
        assert body["data"] == {"saved": True, "note_id": "n1"}
        assert body["error"] is None
        assert isinstance(body["trace_id"], str) and len(body["trace_id"]) == 12

        mock_service.dispatch_action.assert_awaited_once_with(
            action="save_note",
            video_id="abc123",
            params={"text": "hi"},
            user_id="user1",
        )

    async def test_should_return_404_when_video_not_found(self, app_client):
        from src.server import app

        mock_service = AsyncMock()
        mock_service.dispatch_action.side_effect = NotFoundError("Video not found: abc123")
        app.state.assistant_service = mock_service

        response = await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "save_note", "params": {"text": "hi"}},
        )

        assert response.status_code == 404
        body = response.json()
        assert body["success"] is False
        assert body["error"] == "Video not found: abc123"
        assert body["action"] == "save_note"

    async def test_should_return_400_on_validation_error(self, app_client):
        from src.server import app

        mock_service = AsyncMock()
        mock_service.dispatch_action.side_effect = ValidationError(
            "Action 'save_note' requires param 'text'"
        )
        app.state.assistant_service = mock_service

        response = await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "save_note", "params": {}},
        )

        assert response.status_code == 400
        body = response.json()
        assert body["success"] is False
        assert "requires param" in body["error"]

    async def test_should_return_422_for_unknown_action_at_schema_layer(self, app_client):
        response = await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "teleport"},
        )
        assert response.status_code == 422

    async def test_should_return_403_without_internal_secret(self, app_client):
        response = await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "save_note", "params": {"text": "x"}},
            headers={"X-Internal-Secret": "wrong-secret"},
        )
        assert response.status_code == 403

    async def test_should_forward_x_user_id_to_dispatcher(self, app_client):
        from src.server import app

        mock_service = AsyncMock()
        mock_service.dispatch_action.return_value = {"saved": True}
        app.state.assistant_service = mock_service

        await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "save_note", "params": {"text": "x"}},
            headers={"X-User-Id": "user99"},
        )

        kwargs = mock_service.dispatch_action.await_args.kwargs
        assert kwargs["user_id"] == "user99"

    async def test_should_default_user_id_to_none_when_header_missing(self, app_client):
        from src.server import app

        mock_service = AsyncMock()
        mock_service.dispatch_action.return_value = {"saved": True}
        app.state.assistant_service = mock_service

        await app_client.post(
            "/action",
            json={"video_id": "abc123", "action": "save_note", "params": {"text": "x"}},
        )

        kwargs = mock_service.dispatch_action.await_args.kwargs
        assert kwargs["user_id"] is None


def test_action_to_tool_covers_documented_actions():
    """Every action named in the plan must map to a registered tool name."""
    assert set(ACTION_TO_TOOL.keys()) == {"save_note", "quiz_me", "find_moment", "explain"}
    assert ACTION_TO_TOOL["save_note"][0] == "note_taker"
    assert ACTION_TO_TOOL["quiz_me"][0] == "quiz_generator"
    assert ACTION_TO_TOOL["find_moment"][0] == "navigator"
    assert ACTION_TO_TOOL["explain"][0] == "concept_explain"
