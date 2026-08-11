"""Video generator tool — start a video generation via vie-api.

Forwards to vie-api's ``/internal/assistant/generate`` (which routes through
``videoService.createVideo`` to keep cost reservation + the dispatch guard).
This tool is video-OPTIONAL: it operates on a submitted URL, not an existing
library video.
"""

from __future__ import annotations

from src.exceptions import ValidationError
from src.logging_config import get_logger
from src.services.api_client import ApiClient

logger = get_logger(__name__)


class VideoGeneratorTool:
    """Kick off a new video generation from a YouTube URL."""

    name = "video_generator"
    description = "Generate a new video summary from a YouTube URL"

    def __init__(self, api_client: ApiClient) -> None:
        self._api = api_client

    async def execute(self, params: dict, context: dict) -> dict:
        """Start a generation for ``params['url']`` under the calling user.

        Args:
            params: Must contain ``url`` (str). Optional ``folder_id`` (str).
            context: Must contain ``user_id``.

        Returns:
            Dict with ``started`` (bool) and the vie-api ``video`` payload.

        Raises:
            ValidationError: When ``user_id`` or ``url`` is missing.
        """
        user_id = context.get("user_id")
        if not user_id:
            raise ValidationError("video_generator requires an authenticated user")

        url = params.get("url")
        if not url or (isinstance(url, str) and not url.strip()):
            raise ValidationError("Action 'generate_video' requires param 'url'")

        folder_id = params.get("folder_id")
        logger.info("video_generator_dispatch", user_id=user_id, has_folder=folder_id is not None)

        video = await self._api.generate_video(user_id, str(url), folder_id)
        return {"started": True, "video": video}
