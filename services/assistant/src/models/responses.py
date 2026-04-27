"""Response models for the assistant service."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class RAGSource(BaseModel):
    """A retrieved transcript or output chunk used as context."""

    text: str
    video_id: str  # source video — always populated from Qdrant payload
    text_original: str | None = None  # Original-language transcript text (transcript-source only today)
    timestamp: str | None = None
    score: float = 0.0
    chunk_index: int = 0
    source: str = "transcript"  # "transcript" | "default_output"
    tab_id: str | None = None  # set for default_output results
    tab_component: str | None = None  # e.g. "quiz", "overview"
    prop_path: str | None = None  # e.g. "questions[0]"


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
