"""Build the ``transcriptMeta`` block persisted on every pipeline run.

Pure mapping from the transcript phase's outputs — ``TranscriptData`` (absent
when every layer failed), the ``TranscriptTrail`` the fetcher filled, and the
caption fields the metadata phase stamped on ``VideoData`` — to the
Mongo-ready dict documented in docs/DATA-MODELS.md. No settings reads and no
I/O: the pipeline runner calls it from a best-effort ``finally`` so failed
runs are recorded exactly like successful ones.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from src.services.pipeline.pipeline_helpers import TranscriptData, TranscriptTrail
    from src.services.video.youtube import VideoData

# ``transcript_type`` labels emitted by the fallback chain -> research-facing
# kind. ``cached-<origin>`` (S3 hits) is handled by prefix in ``_kind``.
_KIND_BY_TRANSCRIPT_TYPE: dict[str, str] = {
    "manual": "manual",
    "auto-generated": "auto-generated",
    "whisper": "asr",
    "gemini": "asr",
    "metadata": "metadata",
}


def _kind(transcript_type: str | None) -> str | None:
    """Collapse chain labels to manual / auto-generated / asr / metadata / cached."""
    if not transcript_type:
        return None
    if transcript_type.startswith("cached-"):
        return "cached"
    return _KIND_BY_TRANSCRIPT_TYPE.get(transcript_type)


def _origin(trail: TranscriptTrail | None, source: str | None) -> str | None:
    """Layer that originally produced an S3-served transcript.

    Only S3 hits carry one. A blob whose recorded source is itself ``"s3"``
    decayed through a pre-fix regen re-store, so its origin is unknown.
    """
    if source != "s3" or trail is None or trail.origin in (None, "s3"):
        return None
    return trail.origin


def _str_or_none(value: Any) -> str | None:
    """Caption fields are ``str | None`` on a real ``VideoData``; test doubles
    (MagicMock) expose truthy non-strings, which must not leak into Mongo."""
    return value if isinstance(value, str) else None


def build_transcript_meta(
    transcript_data: TranscriptData | None,
    video_data: VideoData | None,
    trail: TranscriptTrail | None,
) -> dict[str, Any]:
    """Return the ``transcriptMeta`` document for one run.

    The error code comes from the trail (stamped by the transcript phase's
    ``finally``). ``attempted`` is copied so later trail mutation cannot
    alias into the persisted dict.
    """
    source = transcript_data.source if transcript_data is not None else None
    return {
        "outcome": "ok" if transcript_data is not None else "failed",
        "source": source,
        "type": _kind(transcript_data.transcript_type) if transcript_data is not None else None,
        "origin": _origin(trail, source),
        "captionTrack": _str_or_none(getattr(video_data, "caption_track", None)),
        "captionLang": _str_or_none(getattr(video_data, "caption_lang", None)),
        "captionFetchError": _str_or_none(getattr(video_data, "caption_fetch_error", None)),
        "captionApiSkipped": bool(trail.caption_api_skipped) if trail is not None else False,
        "attempted": list(trail.attempted) if trail is not None else [],
        "segments": len(transcript_data.segments) if transcript_data is not None else None,
        "chars": len(transcript_data.raw_text or "") if transcript_data is not None else None,
        "fetchWallMs": trail.fetch_wall_ms if trail is not None else None,
        "errorCode": trail.error_code if trail is not None else None,
    }
