"""MongoDB repository for reading video context data."""

from __future__ import annotations

from dataclasses import dataclass, field

from motor.motor_asyncio import AsyncIOMotorDatabase

from src.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class VideoContext:
    """Extracted video context for the assistant."""

    id: str
    youtube_id: str
    title: str
    creator: str
    summary: str
    takeaways: list[str] = field(default_factory=list)
    tabs: list[dict] = field(default_factory=list)
    output_data: dict | None = None


class MongoVideoRepository:
    """Reads video data from the videoSummaryCache collection."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db["videoSummaryCache"]

    async def get_video_context(self, video_id: str) -> VideoContext | None:
        """Load video context by video ID.

        Tries youtubeId first, falls back to _id lookup.

        Args:
            video_id: YouTube video ID or document _id.

        Returns:
            VideoContext if found, None otherwise.
        """
        try:
            doc = await self._collection.find_one({"youtubeId": video_id})
            if not doc:
                doc = await self._collection.find_one({"_id": video_id})
            if not doc:
                return None
            return self._to_entity(doc)
        except Exception:
            logger.exception("failed_to_load_video_context", video_id=video_id)
            return None

    def _to_entity(self, doc: dict) -> VideoContext:
        """Convert a MongoDB document to a VideoContext dataclass."""
        # Extract tabs: prefer v2 assembledTabs, fall back to triage.tabs
        tabs: list[dict] = []
        assembled_tabs = doc.get("assembledTabs")
        if assembled_tabs and isinstance(assembled_tabs, list):
            tabs = assembled_tabs
        else:
            triage = doc.get("triage")
            if isinstance(triage, dict):
                triage_tabs = triage.get("tabs")
                if isinstance(triage_tabs, list):
                    tabs = triage_tabs

        # Extract summary from synthesis
        summary = ""
        synthesis = doc.get("synthesis")
        if isinstance(synthesis, dict):
            summary = synthesis.get("summary", "")

        # Extract takeaways from synthesis
        takeaways: list[str] = []
        if isinstance(synthesis, dict):
            raw_takeaways = synthesis.get("takeaways", [])
            if isinstance(raw_takeaways, list):
                takeaways = [str(t) for t in raw_takeaways if t]

        # Extract output data (full extraction result)
        output_data = doc.get("output")

        return VideoContext(
            id=str(doc.get("_id", "")),
            youtube_id=doc.get("youtubeId", ""),
            title=doc.get("title", ""),
            creator=doc.get("creator", ""),
            summary=summary,
            takeaways=takeaways,
            tabs=tabs,
            output_data=output_data,
        )
