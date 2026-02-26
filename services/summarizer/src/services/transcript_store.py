"""Transcript storage service for S3 operations.

Provides business logic for storing and retrieving raw transcripts,
wrapping the S3 client with transcript-specific operations.

Note: S3 storage is optional - operations will fail gracefully if unavailable.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel

from src.services.s3_client import s3_client, S3Client
from src.models.schemas import TranscriptSource, TranscriptSegment

logger = logging.getLogger(__name__)


class RawTranscript(BaseModel):
    """Full transcript stored in S3 for regeneration."""

    youtube_id: str
    fetched_at: str  # ISO format
    source: TranscriptSource
    language: str | None
    segments: list[dict[str, Any]]  # List of {text, startMs, endMs}


class TranscriptStoreService:
    """Service for storing and retrieving transcripts from S3."""

    def __init__(self):
        self._s3 = s3_client
        self._bucket_verified = False  # Cache bucket existence check

    def _get_key(self, youtube_id: str) -> str:
        """Generate S3 key for a transcript (new path)."""
        return f"videos/{youtube_id}/transcript.json"

    async def store(
        self,
        youtube_id: str,
        segments: list[TranscriptSegment | dict[str, Any]],
        source: TranscriptSource,
        language: str | None = None,
    ) -> str:
        """
        Store a transcript in S3.

        Args:
            youtube_id: YouTube video ID
            segments: List of transcript segments (Pydantic models or dicts)
            source: Source of the transcript (api, ytdlp, proxy, whisper)
            language: Language code if known

        Returns:
            S3 key for the stored transcript

        Raises:
            RuntimeError: If S3 storage is not available
        """
        if not S3Client.is_available():
            raise RuntimeError("S3 storage is not available (aioboto3 not installed)")

        key = self._get_key(youtube_id)

        # Convert Pydantic models to dicts if needed
        segment_dicts = []
        for seg in segments:
            if hasattr(seg, "model_dump"):
                segment_dicts.append(seg.model_dump())
            else:
                segment_dicts.append(seg)

        transcript = RawTranscript(
            youtube_id=youtube_id,
            fetched_at=datetime.now(timezone.utc).isoformat(),
            source=source,
            language=language,
            segments=segment_dicts,
        )

        try:
            # Only check bucket existence once per service lifetime
            if not self._bucket_verified:
                await self._s3.ensure_bucket_exists()
                self._bucket_verified = True

            await self._s3.put_json(key, transcript.model_dump())
            logger.debug("Stored transcript in S3: %s (%d segments)", key, len(segments))
            return key
        except Exception as e:
            logger.warning("Failed to store transcript in S3: %s", e)
            raise

    async def get(self, youtube_id: str) -> RawTranscript | None:
        """
        Retrieve a transcript from S3.

        Args:
            youtube_id: YouTube video ID

        Returns:
            RawTranscript if found, None otherwise
        """
        key = self._get_key(youtube_id)
        data = await self._s3.get_json(key)

        if data is None:
            return None

        return RawTranscript(**data)

    async def get_by_ref(self, ref: str) -> RawTranscript | None:
        """
        Retrieve a transcript by S3 key reference.

        Args:
            ref: S3 key (e.g., "videos/abc123/transcript.json")

        Returns:
            RawTranscript if found, None otherwise
        """
        data = await self._s3.get_json(ref)

        if data is None:
            return None

        return RawTranscript(**data)

    async def exists(self, youtube_id: str) -> bool:
        """
        Check if a transcript exists in S3.

        Args:
            youtube_id: YouTube video ID

        Returns:
            True if transcript exists
        """
        key = self._get_key(youtube_id)
        return await self._s3.exists(key)

    async def delete(self, youtube_id: str) -> None:
        """
        Delete a transcript from S3.

        Args:
            youtube_id: YouTube video ID
        """
        key = self._get_key(youtube_id)
        await self._s3.delete(key)
        logger.info("Deleted transcript from S3: %s", key)


# Singleton instance
transcript_store = TranscriptStoreService()
