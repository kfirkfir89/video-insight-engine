"""Chunk transcript for vector storage.

Uses sentence-boundary splitting with configurable overlap to ensure
semantic coherence within chunks and smooth transitions between them.
"""

import re


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
            chunks.append({
                "text": current.strip(),
                "start_char": current_start,
                "end_char": current_start + len(current),
            })
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
        chunks.append({
            "text": current.strip(),
            "start_char": current_start,
            "end_char": current_start + len(current),
        })

    return chunks
