"""Base protocol for assistant tools."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class BaseTool(Protocol):
    """Protocol that all assistant tools must implement."""

    @property
    def name(self) -> str:
        """Unique tool name."""
        ...

    @property
    def description(self) -> str:
        """Human-readable description of what the tool does."""
        ...

    async def execute(self, params: dict, context: dict) -> dict:
        """Execute the tool with given parameters and context.

        Args:
            params: Tool-specific parameters.
            context: Shared context (video_id, user info, etc.).

        Returns:
            Tool result as a dictionary.
        """
        ...
