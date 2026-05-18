"""Tool routing — intent detection and tool dispatch for the assistant."""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from typing import Any

from src.exceptions import AppError, ValidationError
from src.logging_config import get_logger
from src.models.responses import ChatEvent
from src.repositories.video_repository import VideoContext
from src.tools.base import BaseTool

logger = get_logger(__name__)

# Keyword patterns for intent detection — order matters (first match wins)
_INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    ("note_taker", ["save note", "bookmark this", "take note"]),
    ("quiz_generator", ["quiz me", "test me", "generate quiz", "create questions"]),
    ("concept_explain", ["what is a", "what is an", "define the", "explain the concept"]),
    ("navigator", ["find in video", "navigate to", "show me where", "jump to"]),
    ("cross_reference", ["compare with", "cross-reference", "similar to"]),
]

# Action -> (tool_name, required param keys). Used by /action dispatcher.
ACTION_TO_TOOL: dict[str, tuple[str, tuple[str, ...]]] = {
    "save_note": ("note_taker", ("text",)),
    "quiz_me": ("quiz_generator", ()),
    "find_moment": ("navigator", ("query",)),
    "explain": ("concept_explain", ("concept",)),
}


class ToolRouter:
    """Detects intent from messages and routes to registered tools."""

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        """Register a tool for intent-based routing."""
        self._tools[tool.name] = tool
        logger.info("tool_registered", tool_name=tool.name)

    def get_tool(self, name: str) -> BaseTool | None:
        """Return a registered tool by name (or None)."""
        return self._tools.get(name)

    def detect_intent(self, message: str) -> str | None:
        """Detect tool intent from message keywords.

        Returns:
            Tool name if a match is found, None for default RAG chat.
        """
        lower = message.lower()
        for tool_name, keywords in _INTENT_PATTERNS:
            if tool_name not in self._tools:
                continue
            for keyword in keywords:
                if re.search(rf"\b{re.escape(keyword)}", lower):
                    logger.info("intent_detected", tool=tool_name, keyword=keyword)
                    return tool_name
        return None

    async def route(
        self,
        tool_name: str,
        message: str,
        video_id: str,
        video_ctx: VideoContext,
    ) -> AsyncGenerator[ChatEvent, None]:
        """Route a message to a tool and yield ChatEvent results.

        Yields:
            ChatEvent objects (tool_result or error, then done).
        """
        tool = self._tools.get(tool_name)
        if tool is None:
            logger.error("tool_not_found", tool=tool_name)
            yield ChatEvent(type="error", content=f"Tool '{tool_name}' is not available.")
            yield ChatEvent(type="done", metadata={"video_id": video_id, "tool": tool_name})
            return
        params = _build_tool_params(tool_name, message, video_id)
        context = {"video_ctx": video_ctx, "video_id": video_id}

        logger.info("tool_route", tool=tool_name, video_id=video_id)

        try:
            result = await tool.execute(params, context)
            yield ChatEvent(
                type="tool_result",
                metadata={"tool": tool_name, "result": result},
            )
        except AppError as exc:
            logger.warning("tool_error", tool=tool_name, error=str(exc))
            yield ChatEvent(
                type="error",
                content=f"Tool '{tool_name}' failed: {exc.message}",
            )
        except Exception as exc:
            logger.exception("tool_unexpected_error", tool=tool_name)
            yield ChatEvent(
                type="error",
                content=f"Tool '{tool_name}' encountered an error. Please try again.",
            )

        yield ChatEvent(
            type="done",
            metadata={"video_id": video_id, "tool": tool_name},
        )


def _build_tool_params(tool_name: str, message: str, video_id: str) -> dict:
    """Map the raw message to tool-specific parameter names."""
    if tool_name == "note_taker":
        return {"text": message}
    if tool_name == "quiz_generator":
        return {"topic": message}
    if tool_name == "concept_explain":
        return {"concept": message, "video_id": video_id}
    if tool_name == "navigator":
        return {"query": message}
    if tool_name == "cross_reference":
        return {"query": message, "video_ids": [video_id]}
    return {"query": message, "video_id": video_id}


def _build_action_params(
    action: str,
    payload: dict[str, Any],
    video_id: str,
) -> dict[str, Any]:
    """Map an action's params into the underlying tool's param shape.

    Raises:
        ValidationError: When a required param is missing or empty.
    """
    if action not in ACTION_TO_TOOL:
        raise ValidationError(f"Unknown action: {action}")

    _, required_keys = ACTION_TO_TOOL[action]
    for key in required_keys:
        value = payload.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationError(f"Action '{action}' requires param '{key}'")

    if action == "save_note":
        params: dict[str, Any] = {"text": payload["text"]}
        if "timestamp" in payload:
            params["timestamp"] = payload["timestamp"]
        return params
    if action == "quiz_me":
        params = {}
        if "topic" in payload:
            params["topic"] = payload["topic"]
        if "num_questions" in payload:
            params["num_questions"] = payload["num_questions"]
        return params
    if action == "find_moment":
        return {"query": payload["query"]}
    if action == "explain":
        return {"concept": payload["concept"], "video_id": video_id}
    return dict(payload)


class ActionDispatcher:
    """Dispatch /action requests to registered tools.

    Separate from ``ToolRouter`` so chat-intent and action paths can evolve
    independently. Reuses the same ``BaseTool`` protocol.
    """

    def __init__(self, router: ToolRouter) -> None:
        self._router = router

    async def dispatch(
        self,
        action: str,
        video_id: str,
        params: dict[str, Any],
        video_ctx: VideoContext,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Run the tool matched to ``action``.

        Args:
            action: One of the keys in :data:`ACTION_TO_TOOL`.
            video_id: Target video.
            params: Action-specific parameters (validated per action).
            video_ctx: Loaded video context (passed into tools).
            user_id: Caller's user ID (used to attribute notes).

        Returns:
            The tool's result dict.

        Raises:
            ValidationError: Unknown action or missing required params.
            NotFoundError: Tool isn't registered (should not happen in production).
            AppError: Bubbled up from the tool.
        """
        if action not in ACTION_TO_TOOL:
            raise ValidationError(f"Unknown action: {action}")

        tool_name, _ = ACTION_TO_TOOL[action]
        tool = self._router.get_tool(tool_name)
        if tool is None:
            raise ValidationError(f"Tool '{tool_name}' for action '{action}' is not available")

        tool_params = _build_action_params(action, params, video_id)
        context = {"video_ctx": video_ctx, "video_id": video_id, "user_id": user_id}

        logger.info(
            "action_dispatch",
            action=action,
            tool=tool_name,
            video_id=video_id,
            user_id=user_id,
        )
        return await tool.execute(tool_params, context)
