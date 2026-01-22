from enum import Enum
from typing import Optional
from pydantic import BaseModel


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ErrorCode(str, Enum):
    NO_TRANSCRIPT = "NO_TRANSCRIPT"
    VIDEO_TOO_LONG = "VIDEO_TOO_LONG"
    VIDEO_TOO_SHORT = "VIDEO_TOO_SHORT"
    VIDEO_UNAVAILABLE = "VIDEO_UNAVAILABLE"
    VIDEO_RESTRICTED = "VIDEO_RESTRICTED"
    LIVE_STREAM = "LIVE_STREAM"
    LLM_ERROR = "LLM_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class SummarizeRequest(BaseModel):
    videoSummaryId: str
    youtubeId: str
    url: str
    userId: str | None = None


class SummarizeResponse(BaseModel):
    status: str
    videoSummaryId: str


class Section(BaseModel):
    id: str
    timestamp: str
    start_seconds: int
    end_seconds: int
    title: str
    summary: str
    bullets: list[str]


class Concept(BaseModel):
    id: str
    name: str
    definition: Optional[str] = None
    timestamp: Optional[str] = None


class VideoSummary(BaseModel):
    tldr: str
    key_takeaways: list[str]
    sections: list[Section]
    concepts: list[Concept]
    master_summary: Optional[str] = None


class ProcessingResult(BaseModel):
    title: str
    channel: Optional[str] = None
    duration: Optional[int] = None
    thumbnail_url: Optional[str] = None
    transcript: str
    transcript_type: str
    summary: VideoSummary
    token_usage: dict
