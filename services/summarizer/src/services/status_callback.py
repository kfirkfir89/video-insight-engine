"""Status callback service for WebSocket broadcasts."""

import httpx
import logging

from src.config import settings

logger = logging.getLogger(__name__)


async def send_video_status(
    video_summary_id: str,
    user_id: str | None,
    status: str,
    progress: int | None = None,
    message: str | None = None,
    error: str | None = None,
):
    """Send video status update to API for WebSocket broadcast."""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "type": "video.status",
                "payload": {
                    "videoSummaryId": video_summary_id,
                    "status": status,
                },
            }

            if user_id:
                payload["payload"]["userId"] = user_id
            if progress is not None:
                payload["payload"]["progress"] = progress
            if message:
                payload["payload"]["message"] = message
            if error:
                payload["payload"]["error"] = error

            await client.post(
                f"{settings.API_URL}/internal/status",
                json=payload,
                headers={"X-Internal-Secret": settings.INTERNAL_SECRET},
                timeout=5.0,
            )
    except Exception as e:
        # Log but don't fail - status updates are best-effort
        logger.warning(f"Failed to send status callback: {e}")
