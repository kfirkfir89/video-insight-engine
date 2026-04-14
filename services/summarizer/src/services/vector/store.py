"""Store transcript chunks in Qdrant as a background task.

Called after pipeline completion. Failures are logged but never break the pipeline.
"""

import asyncio
import logging

from src.config import settings
from src.services.vector.chunking import chunk_transcript
from src.services.vector.embedding import embed_texts
from src.services.vector.qdrant_service import VectorService

logger = logging.getLogger(__name__)

_vector_service: VectorService | None = None


def _align_original_to_chunks(
    english_chunks: list[dict],
    original_text: str,
) -> list[dict] | None:
    """Align original-language text to English chunks by proportional character offsets.

    Since sentence boundaries differ across languages, independent chunking produces
    different counts. Instead, split the original text proportionally based on where
    each English chunk falls relative to the total English text.
    """
    total_en_chars = sum(len(c["text"]) for c in english_chunks)
    if total_en_chars == 0 or not original_text:
        return None

    original_chunks = []
    orig_len = len(original_text)
    cursor = 0

    for i, chunk in enumerate(english_chunks):
        ratio = len(chunk["text"]) / total_en_chars
        if i == len(english_chunks) - 1:
            # Last chunk gets the remainder
            segment = original_text[cursor:]
        else:
            end = min(cursor + int(ratio * orig_len), orig_len)
            segment = original_text[cursor:end]
            cursor = end

        original_chunks.append({"text": segment.strip() or segment})

    return original_chunks if len(original_chunks) == len(english_chunks) else None


def _get_vector_service() -> VectorService:
    """Lazy singleton for VectorService."""
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorService()
    return _vector_service


async def store_transcript_chunks(
    video_id: str,
    transcript: str,
    language: str = "en",
    transcript_original: str | None = None,
) -> None:
    """Chunk, embed, and store transcript in Qdrant.

    For non-English videos, ``transcript`` should be the English translation
    (for embedding) and ``transcript_original`` is the original-language text.

    Designed to run as a background task — never raises.
    """
    if not settings.QDRANT_ENABLED:
        return

    try:
        chunks = chunk_transcript(transcript)
        if not chunks:
            logger.debug("No chunks produced for video %s", video_id)
            return

        # Align original text to English chunks by proportional character mapping.
        # Independent chunking fails because sentence boundaries differ across languages.
        original_chunks = None
        if transcript_original and language != "en":
            original_chunks = _align_original_to_chunks(chunks, transcript_original)

        texts = [c["text"] for c in chunks]
        embeddings = await asyncio.to_thread(embed_texts, texts)

        service = _get_vector_service()
        success = await asyncio.to_thread(
            service.store_chunks, video_id, chunks, embeddings,
            language, original_chunks,
        )

        if success:
            logger.info(
                "Stored %d transcript chunks for video %s (language=%s, has_original=%s)",
                len(chunks), video_id, language, original_chunks is not None,
            )
        else:
            logger.warning("Failed to store chunks for video %s", video_id)

    except Exception as e:
        logger.warning(
            "Background chunk storage failed for %s: %s", video_id, e,
        )
