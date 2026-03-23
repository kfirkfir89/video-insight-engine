"""Serve extracted keyframe images from local storage.

Fallback for when S3 is not available. In production, S3 presigned URLs
are preferred (already handled by frame_extractor.py).
"""

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

FRAME_STORAGE_PATH = Path("storage/frames")
# Allowlist: alphanumeric, hyphen, underscore, dot (no leading dot)
_SAFE_COMPONENT = re.compile(r"^[a-zA-Z0-9_-][a-zA-Z0-9_.\-]*$")

router = APIRouter()


@router.get("/api/frames/{video_id}/{filename}")
async def serve_frame(video_id: str, filename: str) -> FileResponse:
    """Serve a stored frame image.

    Args:
        video_id: YouTube video ID.
        filename: Frame filename (e.g., 'scene_0001.jpg').

    Returns:
        JPEG image file.
    """
    # Allowlist validation to prevent directory traversal
    if not _SAFE_COMPONENT.match(video_id) or not _SAFE_COMPONENT.match(filename):
        raise HTTPException(status_code=400, detail="Invalid path")

    path = (FRAME_STORAGE_PATH / video_id / filename).resolve()

    # Defense-in-depth: ensure resolved path is still under storage root
    if not str(path).startswith(str(FRAME_STORAGE_PATH.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Frame not found")

    return FileResponse(path, media_type="image/jpeg")
