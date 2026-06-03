"""Tool routing — intent detection and tool dispatch for the assistant."""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from typing import Any

from llm_common.context import llm_feature_var

from src.exceptions import AppError, ValidationError
from src.logging_config import get_logger
from src.models.responses import ChatEvent
from src.repositories.video_repository import VideoContext
from src.services.observability import span
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
    "generate_video": ("video_generator", ("url",)),
    "organize_library": ("library_organizer", ()),
    "create_folder": ("folder_organizer", ("name",)),
    "rename_folder": ("folder_organizer", ("folder_id", "name")),
    "move_folder": ("folder_organizer", ("folder_id",)),
    "delete_folder": ("folder_organizer", ("folder_id",)),
    "move_video": ("folder_organizer", ("video_id",)),
}

# Actions that target a single video and therefore require a ``video_id``.
_VIDEO_SCOPED_ACTIONS = frozenset({
    "save_note",
    "quiz_me",
    "find_moment",
    "explain",
})

# Actions that operate on the user's whole library, not a single video.
_LIBRARY_ACTIONS = frozenset({
    "generate_video",
    "organize_library",
    "create_folder",
    "rename_folder",
    "move_folder",
    "delete_folder",
    "move_video",
})


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

        # Attribute this tool's LLM calls to the specific tool feature, then
        # restore the previous value — so a generation running after route()
        # (or a sibling tool in the same request) isn't mislabelled.
        token = llm_feature_var.set(f"assistant:tool:{tool_name}")
        try:
            async with span(f"tool:{tool_name}"):
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
        except Exception:
            logger.exception("tool_unexpected_error", tool=tool_name)
            yield ChatEvent(
                type="error",
                content=f"Tool '{tool_name}' encountered an error. Please try again.",
            )
        finally:
            llm_feature_var.reset(token)

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


# Payload keys passed through verbatim to folder/library/generate tools.
_PASS_THROUGH_KEYS = ("name", "folder_id", "parent_id", "video_id", "url", "color", "icon", "delete_content")


def _build_action_params(
    action: str,
    payload: dict[str, Any],
    video_id: str | None,
) -> dict[str, Any]:
    """Map an action's params into the underlying tool's param shape.

    Raises:
        ValidationError: When a required param is missing or empty.
    """
    if action not in ACTION_TO_TOOL:
        raise ValidationError(f"Unknown action: {action}")

    if action in _VIDEO_SCOPED_ACTIONS and not video_id:
        raise ValidationError(f"Action '{action}' requires a video_id")

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
    if action in _LIBRARY_ACTIONS:
        return {k: payload[k] for k in _PASS_THROUGH_KEYS if k in payload}
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
        video_id: str | None,
        params: dict[str, Any],
        video_ctx: VideoContext | None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Run the tool matched to ``action``.

        Args:
            action: One of the keys in :data:`ACTION_TO_TOOL`.
            video_id: Target video, or ``None`` for library-scoped actions.
            params: Action-specific parameters (validated per action).
            video_ctx: Loaded video context, or ``None`` when no video is in
                scope (library actions).
            user_id: Caller's user ID (used to attribute notes and scope
                library mutations).

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
        context = {
            "video_ctx": video_ctx,
            "video_id": video_id,
            "user_id": user_id,
            "action": action,
        }

        logger.info(
            "action_dispatch",
            action=action,
            tool=tool_name,
            video_id=video_id,
            user_id=user_id,
        )
        # Attribute this tool's LLM calls to the specific tool feature, then
        # restore the previous value so nothing after dispatch is mislabelled.
        token = llm_feature_var.set(f"assistant:tool:{tool_name}")
        try:
            async with span(f"tool:{tool_name}"):
                return await tool.execute(tool_params, context)
        finally:
            llm_feature_var.reset(token)
