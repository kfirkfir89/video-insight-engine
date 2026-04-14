"""Response models for the assistant service."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class RAGSource(BaseModel):
    """A retrieved transcript chunk used as context."""

    text: str
    text_original: str | None = None  # Original-language text for non-English videos
    timestamp: str | None = None
    score: float = 0.0
    chunk_index: int = 0


class ChatEvent(BaseModel):
    """A single SSE event in a chat stream."""

    type: Literal["text", "source", "tool_result", "error", "done"]
    content: str = ""
    sources: list[RAGSource] | None = None
    metadata: dict[str, Any] | None = None


class ActionResponse(BaseModel):
    """Response from an action request."""

    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None
