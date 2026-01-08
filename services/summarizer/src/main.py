import time
import logging

from fastapi import FastAPI, BackgroundTasks

from src.config import settings
from src.models.schemas import (
    SummarizeRequest,
    SummarizeResponse,
    ProcessingStatus,
    ErrorCode,
)
from src.services import mongodb, transcript, metadata, llm

app = FastAPI(title="vie-summarizer")
logger = logging.getLogger(__name__)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "vie-summarizer",
        "model": settings.ANTHROPIC_MODEL,
    }


@app.get("/")
async def root():
    return {"service": "vie-summarizer", "version": "0.1.0"}


@app.post("/summarize", response_model=SummarizeResponse, status_code=202)
async def summarize(request: SummarizeRequest, background_tasks: BackgroundTasks):
    """
    Trigger video summarization.
    Returns immediately, processing happens in background.
    """
    background_tasks.add_task(
        run_summarization,
        request.videoSummaryId,
        request.youtubeId,
        request.url,
        request.userId
    )

    return SummarizeResponse(
        status="accepted",
        videoSummaryId=request.videoSummaryId
    )


async def run_summarization(
    video_summary_id: str,
    youtube_id: str,
    url: str,
    user_id: str | None
):
    """Background task to process video."""
    start_time = time.time()

    try:
        # Update status to processing
        mongodb.update_status(video_summary_id, ProcessingStatus.PROCESSING)

        logger.info(f"Processing video {youtube_id} (id: {video_summary_id})")

        # 1. Fetch metadata
        meta = await metadata.get_video_metadata(youtube_id)

        # 2. Fetch transcript
        segments, raw_transcript, transcript_type = transcript.get_transcript(youtube_id)

        # Calculate duration
        duration = None
        if segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

            # Check duration limits
            if duration > settings.MAX_VIDEO_DURATION_MINUTES * 60:
                raise transcript.TranscriptError(
                    f"Video too long ({duration // 60} min)",
                    ErrorCode.VIDEO_TOO_LONG
                )
            if duration < settings.MIN_VIDEO_DURATION_SECONDS:
                raise transcript.TranscriptError(
                    f"Video too short ({duration} sec)",
                    ErrorCode.VIDEO_TOO_SHORT
                )

        # 3. Clean transcript
        clean_text = transcript.clean_transcript(raw_transcript)

        # 4. Process with LLM
        summary = llm.process_video(clean_text, segments)

        # 5. Save result
        processing_time = int((time.time() - start_time) * 1000)

        result = {
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

        mongodb.save_result(video_summary_id, result)

        logger.info(f"Completed video {youtube_id} in {processing_time}ms")

    except transcript.TranscriptError as e:
        mongodb.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        logger.error(f"Failed {youtube_id}: {e}")

    except Exception as e:
        mongodb.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.UNKNOWN_ERROR)
        logger.error(f"Failed {youtube_id}: {e}")
