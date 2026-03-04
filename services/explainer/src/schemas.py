"""Pydantic schemas and domain models for vie-explainer service."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ============================================================
# Domain Models
# ============================================================


class ChatMessage(BaseModel):
    """Single chat message in a conversation."""

    role: str  # "user" | "assistant"
    content: str
    createdAt: datetime


class Chat(BaseModel):
    """User chat session."""

    id: str
    userId: str
    memorizedItemId: str
    messages: list[ChatMessage] = Field(default_factory=list)
    title: str | None = None
    createdAt: datetime
    updatedAt: datetime


class Expansion(BaseModel):
    """Cached expansion/documentation for a section or concept."""

    id: str
    videoSummaryId: str
    targetType: str  # "section" | "concept"
    targetId: str
    context: dict[str, Any]
    content: str
    status: str = "completed"
    version: int = 1
    model: str
    generatedAt: datetime
    createdAt: datetime


class VideoSummarySection(BaseModel):
    """Section within a video summary."""

    id: str
    title: str
    timestamp: str = "00:00"
    content: list[dict[str, Any]] = Field(default_factory=list)


class VideoSummaryConcept(BaseModel):
    """Concept within a video summary."""

    id: str
    name: str
    definition: str = ""


class VideoSummary(BaseModel):
    """Video summary from cache (read-only)."""

    id: str
    youtubeId: str
    title: str
    output_type: str = "summary"
    sections: list[VideoSummarySection] = Field(default_factory=list)
    concepts: list[VideoSummaryConcept] = Field(default_factory=list)


class MemorizedItemSource(BaseModel):
    """Source data for a memorized item."""

    videoTitle: str = "Unknown Video"
    youtubeUrl: str = ""
    content: dict[str, Any] = Field(default_factory=dict)


class MemorizedItem(BaseModel):
    """User's memorized content item."""

    id: str
    userId: str
    title: str
    source: MemorizedItemSource
    notes: str | None = None
    createdAt: datetime
    updatedAt: datetime
