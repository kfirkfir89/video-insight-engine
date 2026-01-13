"""SponsorBlock API client for detecting sponsor segments in YouTube videos.

SponsorBlock is a community-maintained database of sponsor segments.
API docs: https://wiki.sponsor.ajay.app/w/API_Docs
"""

import json
import logging
from dataclasses import dataclass
from typing import TypedDict

import httpx

from config import settings

logger = logging.getLogger(__name__)

# SponsorBlock API configuration
SPONSORBLOCK_API_BASE = "https://sponsor.ajay.app/api"

# Categories to skip from summarization
SKIP_CATEGORIES = [
    "sponsor",      # Paid promotion
    "selfpromo",    # Self-promotion (merch, patreon, etc.)
    "intro",        # Intermission/intro animation
    "outro",        # Credits/outro
    "interaction",  # Reminder to subscribe/like
]


class TranscriptSegment(TypedDict):
    """A transcript segment with timing information."""
    text: str
    start: float
    duration: float


@dataclass
class SponsorSegment:
    """A sponsor segment detected in a video."""
    start_seconds: float
    end_seconds: float
    category: str
    uuid: str  # SponsorBlock segment ID


async def get_sponsor_segments(video_id: str) -> list[SponsorSegment]:
    """
    Fetch sponsor segments from SponsorBlock API.

    Args:
        video_id: YouTube video ID

    Returns:
        List of SponsorSegment objects, empty list if none found or API unavailable
    """
    # Build categories query param
    categories_param = str(SKIP_CATEGORIES).replace("'", '"')
    url = f"{SPONSORBLOCK_API_BASE}/skipSegments?videoID={video_id}&categories={categories_param}"

    try:
        async with httpx.AsyncClient(timeout=settings.SPONSORBLOCK_TIMEOUT) as client:
            response = await client.get(url)

            if response.status_code == 404:
                # No segments found for this video
                logger.debug(f"No SponsorBlock segments for video {video_id}")
                return []

            if response.status_code != 200:
                logger.warning(f"SponsorBlock API error: {response.status_code}")
                return []

            try:
                data = response.json()
            except json.JSONDecodeError as e:
                logger.warning(f"SponsorBlock API returned invalid JSON for video {video_id}: {e}")
                return []

            segments = []

            for item in data:
                segment = item.get("segment", [])
                if len(segment) >= 2:
                    segments.append(SponsorSegment(
                        start_seconds=float(segment[0]),
                        end_seconds=float(segment[1]),
                        category=item.get("category", "sponsor"),
                        uuid=item.get("UUID", ""),
                    ))

            if segments:
                total_duration = sum(s.end_seconds - s.start_seconds for s in segments)
                logger.info(
                    f"Found {len(segments)} sponsor segments for video {video_id} "
                    f"(total: {total_duration:.1f}s)"
                )

            return segments

    except httpx.TimeoutException:
        logger.warning(f"SponsorBlock API timeout for video {video_id}")
        return []
    except Exception as e:
        logger.warning(f"SponsorBlock API error for video {video_id}: {e}")
        return []


def filter_transcript_segments(
    transcript_segments: list[TranscriptSegment],
    sponsor_segments: list[SponsorSegment],
) -> list[TranscriptSegment]:
    """
    Filter transcript segments to exclude sponsor content.

    Args:
        transcript_segments: List of transcript segments with 'text', 'start', 'duration'
        sponsor_segments: List of sponsor segments to exclude

    Returns:
        Filtered transcript segments with sponsor content removed
    """
    if not sponsor_segments:
        return transcript_segments

    filtered = []
    for segment in transcript_segments:
        seg_start = segment.get("start", 0)
        seg_end = seg_start + segment.get("duration", 0)

        # Check if this segment overlaps with any sponsor segment
        is_sponsor = False
        for sponsor in sponsor_segments:
            # Segment is considered sponsor if it mostly overlaps
            # (more than 50% of the segment is within sponsor range)
            overlap_start = max(seg_start, sponsor.start_seconds)
            overlap_end = min(seg_end, sponsor.end_seconds)
            overlap_duration = max(0, overlap_end - overlap_start)
            segment_duration = seg_end - seg_start

            if segment_duration > 0 and overlap_duration / segment_duration > 0.5:
                is_sponsor = True
                break

        if not is_sponsor:
            filtered.append(segment)

    removed_count = len(transcript_segments) - len(filtered)
    if removed_count > 0:
        logger.info(f"Filtered {removed_count} transcript segments as sponsor content")

    return filtered


def calculate_content_duration(
    total_duration: float,
    sponsor_segments: list[SponsorSegment],
) -> float:
    """
    Calculate actual content duration excluding sponsors.

    Args:
        total_duration: Total video duration in seconds
        sponsor_segments: List of sponsor segments

    Returns:
        Content duration with sponsors excluded
    """
    if not sponsor_segments:
        return total_duration

    sponsor_duration = sum(
        s.end_seconds - s.start_seconds
        for s in sponsor_segments
    )
    return max(0, total_duration - sponsor_duration)


def sponsor_segments_to_dict(segments: list[SponsorSegment]) -> list[dict]:
    """Convert sponsor segments to serializable dict format."""
    return [
        {
            "startSeconds": s.start_seconds,
            "endSeconds": s.end_seconds,
            "category": s.category,
        }
        for s in segments
    ]
