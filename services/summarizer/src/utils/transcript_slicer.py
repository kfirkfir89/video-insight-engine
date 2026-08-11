"""Transcript slicing utilities for chapter-level transcript extraction.

This module provides functions to extract transcript text for specific time ranges,
enabling:
- Per-chapter transcript storage for RAG embedding
- Transcript display alongside generated content
- Debug/audit trail for LLM input vs output
"""

from typing import Any


def slice_transcript_for_chapter(
    segments: list[dict[str, Any]],
    start_seconds: int,
    end_seconds: int,
) -> str:
    """
    Extract transcript text for a specific time range.

    Uses segment startMs to determine inclusion - a segment is included
    if its start time falls within [start_seconds, end_seconds).

    Args:
        segments: List of transcript segments with text, startMs, endMs
        start_seconds: Chapter start time in seconds
        end_seconds: Chapter end time in seconds

    Returns:
        Concatenated transcript text for the time range, space-separated
    """
    if not segments:
        return ""

    start_ms = start_seconds * 1000
    end_ms = end_seconds * 1000

    texts: list[str] = []

    for seg in segments:
        seg_start_ms = seg.get("startMs", 0)

        # Include segment if its start falls within the chapter range
        if start_ms <= seg_start_ms < end_ms:
            text = seg.get("text")
            if text:
                cleaned = str(text).strip()
                if cleaned:
                    texts.append(cleaned)

    return " ".join(texts)


def slice_transcript_for_chapters(
    segments: list[dict[str, Any]],
    chapters: list[dict[str, Any]],
) -> list[str]:
    """
    Extract transcript text for multiple chapters.

    Args:
        segments: List of transcript segments with text, startMs, endMs
        chapters: List of chapter dicts with startSeconds and endSeconds

    Returns:
        List of transcript strings, one per chapter in order
    """
    if not chapters:
        return []

    return [
        slice_transcript_for_chapter(
            segments,
            start_seconds=ch.get("startSeconds", 0),
            end_seconds=ch.get("endSeconds", 0),
        )
        for ch in chapters
    ]
