"""Tests for ToolRouter — the tool registry behind the action dispatcher.

The English-only keyword intent router (``detect_intent`` / ``route``) was
retired: the agentic loop (``AssistantService._run_agentic_loop``) owns tool
selection in both chat modes, and structured ``/action`` requests dispatch
through :class:`ActionDispatcher` (covered in ``test_action.py``).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import src.services.tool_router as tool_router_module
from src.services.tool_router import ToolRouter


class _StubTool:
    def __init__(self, name: str, result: dict | None = None) -> None:
        self.name = name
        self.description = "stub"
        self.execute = AsyncMock(return_value=result or {"ok": True})


class TestRegistry:
    """ToolRouter.register / get_tool — plain name-keyed registry."""

    def test_should_return_registered_tool_by_name(self):
        router = ToolRouter()
        tool = _StubTool("note_taker")
        router.register(tool)
        assert router.get_tool("note_taker") is tool

    def test_should_return_none_for_unregistered_tool(self):
        router = ToolRouter()
        assert router.get_tool("nonexistent") is None

    def test_should_overwrite_tool_registered_under_same_name(self):
        router = ToolRouter()
        first = _StubTool("note_taker")
        second = _StubTool("note_taker")
        router.register(first)
        router.register(second)
        assert router.get_tool("note_taker") is second


class TestKeywordRouterRetired:
    """The keyword intent path must stay deleted (agentic loop owns selection)."""

    def test_detect_intent_is_deleted(self):
        assert not hasattr(ToolRouter, "detect_intent")

    def test_route_is_deleted(self):
        assert not hasattr(ToolRouter, "route")

    def test_keyword_helpers_are_deleted(self):
        assert not hasattr(tool_router_module, "_INTENT_PATTERNS")
        assert not hasattr(tool_router_module, "_build_tool_params")
