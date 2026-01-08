import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

from src.models.schemas import ErrorCode

# Create API instance (new API style)
ytt_api = YouTubeTranscriptApi()


class TranscriptError(Exception):
    def __init__(self, message: str, code: ErrorCode):
        super().__init__(message)
        self.code = code


def get_transcript(video_id: str) -> tuple[list[dict], str, str]:
    """
    Fetch transcript from YouTube.

    Returns:
        (segments, full_text, transcript_type)
    """
    try:
        # New API: use instance method .list() instead of class method .list_transcripts()
        transcript_list = ytt_api.list(video_id)

        # Prefer manual captions
        transcript = None
        transcript_type = "auto-generated"

        try:
            transcript = transcript_list.find_manually_created_transcript(["en"])
            transcript_type = "manual"
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(["en"])
            except Exception:
                # Try any available
                for t in transcript_list:
                    transcript = t
                    break

        if not transcript:
            raise TranscriptError("No transcript available", ErrorCode.NO_TRANSCRIPT)

        # Fetch transcript and convert to dict format
        fetched = transcript.fetch()
        # New API returns FetchedTranscript object, convert to raw data
        segments = fetched.to_raw_data() if hasattr(fetched, 'to_raw_data') else list(fetched)

        # Handle both old dict format and new snippet format
        if segments and hasattr(segments[0], 'text'):
            segments = [{"text": s.text, "start": s.start, "duration": s.duration} for s in segments]

        full_text = " ".join([s["text"] for s in segments])

        return segments, full_text, transcript_type

    except TranscriptsDisabled:
        raise TranscriptError("Captions are disabled for this video", ErrorCode.NO_TRANSCRIPT)
    except NoTranscriptFound:
        raise TranscriptError("No English transcript available", ErrorCode.NO_TRANSCRIPT)
    except VideoUnavailable:
        raise TranscriptError("Video is unavailable or private", ErrorCode.VIDEO_UNAVAILABLE)
    except TranscriptError:
        raise
    except Exception as e:
        raise TranscriptError(f"Failed to fetch transcript: {str(e)}", ErrorCode.UNKNOWN_ERROR)


def clean_transcript(text: str) -> str:
    """Clean and normalize transcript text."""
    # Remove common artifacts
    text = re.sub(r"\[Music\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[Applause\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[Laughter\]", "", text, flags=re.IGNORECASE)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()
