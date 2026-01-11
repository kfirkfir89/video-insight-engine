"""Video summarization service - business logic orchestration."""

import time
import logging
from typing import Callable

from src.config import settings
from src.models.schemas import ProcessingStatus, ErrorCode
from src.repositories.base import VideoRepository
from src.exceptions import TranscriptError
from src.services import transcript, metadata
from src.services.llm import LLMService
from src.services.status_callback import send_video_status

logger = logging.getLogger(__name__)


class SummarizeService:
    """Orchestrates the video summarization pipeline."""

    def __init__(self, repository: VideoRepository, llm_service: LLMService):
        self._repository = repository
        self._llm = llm_service

    async def process_video(
        self,
        video_summary_id: str,
        youtube_id: str,
        url: str,
        user_id: str | None = None,
        on_progress: Callable[[int, str], None] | None = None,
    ) -> None:
        """
        Execute the full video summarization pipeline.

        Args:
            video_summary_id: Database ID for the video summary cache entry
            youtube_id: YouTube video ID
            url: Full YouTube URL
            user_id: Optional user ID for WebSocket notifications
            on_progress: Optional callback for progress updates
        """
        start_time = time.time()
        logger.info(f"Starting summarization for {youtube_id}")

        try:
            # Update status to processing
            self._repository.update_status(video_summary_id, ProcessingStatus.PROCESSING)
            await self._notify_progress(video_summary_id, user_id, "processing", 10, "Starting processing...")

            logger.info(f"Processing video {youtube_id} (id: {video_summary_id})")

            # 1. Fetch metadata
            await self._notify_progress(video_summary_id, user_id, "processing", 20, "Fetching video metadata...")
            meta = await metadata.get_video_metadata(youtube_id)
            logger.debug(f"Got metadata: {meta.get('title')}")

            # 2. Fetch transcript (async - runs in thread pool)
            await self._notify_progress(video_summary_id, user_id, "processing", 30, "Fetching transcript...")
            logger.debug("Fetching transcript...")
            segments, raw_transcript, transcript_type = await transcript.get_transcript(youtube_id)
            logger.debug(f"Got {len(segments)} segments, type: {transcript_type}")

            # 3. Validate duration
            duration = self._calculate_and_validate_duration(segments)

            # 4. Clean transcript
            await self._notify_progress(video_summary_id, user_id, "processing", 50, "Cleaning transcript...")
            clean_text = transcript.clean_transcript(raw_transcript)

            # 5. Process with LLM (async - runs in thread pool)
            await self._notify_progress(video_summary_id, user_id, "processing", 60, "Generating summary with AI...")
            logger.debug("Calling LLM to generate summary...")
            summary = await self._llm.process_video(clean_text, segments, on_progress)
            logger.debug(f"LLM completed, got {len(summary.get('sections', []))} sections")

            # 6. Save result
            processing_time = int((time.time() - start_time) * 1000)
            result = self._build_result(
                meta=meta,
                youtube_id=youtube_id,
                duration=duration,
                raw_transcript=raw_transcript,
                transcript_type=transcript_type,
                summary=summary,
                processing_time=processing_time,
            )

            await self._notify_progress(video_summary_id, user_id, "processing", 90, "Saving results...")
            self._repository.save_result(video_summary_id, result)

            await self._notify_progress(video_summary_id, user_id, "completed", 100, "Complete!")
            logger.info(f"Completed video {youtube_id} in {processing_time}ms")

        except TranscriptError as e:
            await self._handle_error(video_summary_id, user_id, youtube_id, str(e), e.code)

        except Exception as e:
            import traceback
            logger.error(f"Failed {youtube_id}: {e}\n{traceback.format_exc()}")
            await self._handle_error(video_summary_id, user_id, youtube_id, str(e), ErrorCode.UNKNOWN_ERROR)

    def _calculate_and_validate_duration(self, segments: list[dict]) -> int | None:
        """Calculate video duration and validate against limits."""
        if not segments:
            return None

        last = segments[-1]
        duration = int(last["start"] + last.get("duration", 0))

        if duration > settings.MAX_VIDEO_DURATION_MINUTES * 60:
            raise TranscriptError(
                f"Video too long ({duration // 60} min)",
                ErrorCode.VIDEO_TOO_LONG
            )

        if duration < settings.MIN_VIDEO_DURATION_SECONDS:
            raise TranscriptError(
                f"Video too short ({duration} sec)",
                ErrorCode.VIDEO_TOO_SHORT
            )

        return duration

    def _build_result(
        self,
        meta: dict,
        youtube_id: str,
        duration: int | None,
        raw_transcript: str,
        transcript_type: str,
        summary: dict,
        processing_time: int,
    ) -> dict:
        """Build the result dictionary for storage."""
        return {
            "title": meta["title"],
            "channel": meta.get("channel"),
            "duration": duration,
            "thumbnail_url": meta.get("thumbnail_url") or metadata.get_thumbnail_url(youtube_id),
            "transcript": raw_transcript,
            "transcript_type": transcript_type,
            "summary": summary,
            "processing_time_ms": processing_time,
            "token_usage": {},  # TODO: Track token usage
        }

    async def _notify_progress(
        self,
        video_summary_id: str,
        user_id: str | None,
        status: str,
        progress: int,
        message: str,
    ) -> None:
        """Send progress notification via WebSocket."""
        await send_video_status(video_summary_id, user_id, status, progress, message)

    async def _handle_error(
        self,
        video_summary_id: str,
        user_id: str | None,
        youtube_id: str,
        error_message: str,
        error_code: ErrorCode,
    ) -> None:
        """Handle processing error - update status and notify."""
        self._repository.update_status(
            video_summary_id,
            ProcessingStatus.FAILED,
            error_message,
            error_code
        )
        await send_video_status(video_summary_id, user_id, "failed", error=error_message)
        logger.error(f"Failed {youtube_id}: {error_message}")
