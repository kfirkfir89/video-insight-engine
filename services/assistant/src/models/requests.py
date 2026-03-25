"""Request models for the assistant service."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in a conversation."""

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    """Request to chat about a video."""

    video_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    message: str = Field(..., min_length=1, max_length=10000)
    conversation_history: list[ChatMessage] = Field(
        default_factory=list, max_length=50
    )


class ActionRequest(BaseModel):
    """Request to perform an action on a video."""

    video_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    action: str
    params: dict[str, str | int | float | bool] = Field(default_factory=dict)
