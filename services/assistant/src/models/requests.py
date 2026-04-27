"""Request models for the assistant service."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

VideoId = Annotated[
    str,
    StringConstraints(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$"),
]


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


class LibrarySearchRequest(BaseModel):
    """Request to semantically search across a library of videos.

    Auth assumption: the caller (Node api gateway) has already verified that
    the requesting user owns or has access to every ``video_id`` in the list.
    The assistant trusts the list — same pattern as ``/chat``.
    """

    video_ids: list[VideoId] = Field(..., min_length=1, max_length=200)
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=50)
    sources: list[Literal["transcript", "default_output"]] | None = None
