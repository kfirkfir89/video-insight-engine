"""Chunk transcript for vector storage.

Uses sentence-boundary splitting with configurable overlap to ensure
semantic coherence within chunks and smooth transitions between them.
``assign_chunk_timestamps`` then maps each chunk back onto the transcript
segment timeline so Qdrant payloads carry start/end times for [MM:SS]
citations.
"""

from __future__ import annotations

import re
from bisect import bisect_right


def chunk_transcript(
    transcript: str,
    max_chunk_chars: int = 1000,
    overlap_chars: int = 200,
) -> list[dict]:
    """Split transcript into overlapping chunks at sentence boundaries.

    Args:
        transcript: Full transcript text.
        max_chunk_chars: Maximum characters per chunk.
        overlap_chars: Characters of overlap between consecutive chunks.

    Returns:
        List of dicts with 'text', 'start_char', 'end_char' keys.
    """
    if not transcript or not transcript.strip():
        return []

    sentences = re.split(r"(?<=[.!?])\s+", transcript.strip())
    if not sentences:
        return []

    chunks: list[dict] = []
    current = ""
    current_start = 0

    for sent in sentences:
        if not sent.strip():
            continue

        # If adding this sentence exceeds limit and we have content, flush
        if len(current) + len(sent) + 1 > max_chunk_chars and current:
            chunks.append(
                {
                    "text": current.strip(),
                    "start_char": current_start,
                    "end_char": current_start + len(current),
                }
            )
            # Keep overlap from end of current chunk
            if len(current) > overlap_chars:
                overlap = current[-overlap_chars:]
                current_start += len(current) - len(overlap)
                current = overlap
            else:
                current_start += len(current)
                current = ""

        current = (current + " " + sent) if current else sent

    # Flush remaining content
    if current.strip():
        chunks.append(
            {
                "text": current.strip(),
                "start_char": current_start,
                "end_char": current_start + len(current),
            }
        )

    return chunks


def _segment_times(seg: dict) -> tuple[float, float]:
    """Extract (start_s, end_s) from a segment in either pipeline shape.

    Supports ``start``/``duration`` (seconds) and ``startMs``/``endMs``.
    """
    if "startMs" in seg:
        start = float(seg["startMs"]) / 1000.0
        end = float(seg.get("endMs", seg["startMs"])) / 1000.0
    else:
        start = float(seg.get("start", 0.0))
        end = start + float(seg.get("duration", 0.0))
    return start, max(start, end)


def assign_chunk_timestamps(
    chunks: list[dict],
    segments: list[dict],
) -> list[dict]:
    """Add ``start_time``/``end_time`` (seconds) to chunks, in place.

    Projects each chunk's ``start_char``/``end_char`` onto the cumulative
    character offsets of the transcript segments to find which segment the
    chunk begins and ends in, then takes that segment's start/end time.

    The mapping is proportional rather than exact: the chunked text is the
    CLEANED (and, for non-English videos, Whisper-translated) transcript, so
    character offsets do not survive one-to-one back to the raw segments. The
    projection is monotonic and accurate to within a segment or two — good
    enough for [MM:SS] citations.

    Chunks are returned unchanged (no time keys added) when ``segments`` is
    empty — e.g. metadata-only transcripts, which intentionally carry no
    segments.
    """
    if not chunks or not segments:
        return chunks

    # (cumulative_start_char, segment_start_s, segment_end_s) per segment.
    spans: list[tuple[int, float, float]] = []
    cum = 0
    for seg in segments:
        text = str(seg.get("text") or "")
        if not text.strip():
            continue
        start_s, end_s = _segment_times(seg)
        spans.append((cum, start_s, end_s))
        cum += len(text) + 1  # +1 for the joining space between segments

    total_chunk_chars = max(c.get("end_char", 0) for c in chunks)
    if not spans or cum <= 0 or total_chunk_chars <= 0:
        return chunks

    scale = cum / total_chunk_chars
    span_starts = [s[0] for s in spans]
    last = len(spans) - 1
    for chunk in chunks:
        start_idx = bisect_right(span_starts, chunk.get("start_char", 0) * scale) - 1
        end_idx = bisect_right(span_starts, chunk.get("end_char", 0) * scale) - 1
        start_idx = max(0, min(start_idx, last))
        end_idx = max(start_idx, min(end_idx, last))
        chunk["start_time"] = round(spans[start_idx][1], 2)
        chunk["end_time"] = round(spans[end_idx][2], 2)
    return chunks
