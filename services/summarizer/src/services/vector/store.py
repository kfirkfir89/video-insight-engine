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


def _get_vector_service() -> VectorService:
    """Lazy singleton for VectorService."""
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorService()
    return _vector_service


async def store_transcript_chunks(video_id: str, transcript: str) -> None:
    """Chunk, embed, and store transcript in Qdrant.

    Designed to run as a background task — never raises.
    """
    if not settings.QDRANT_ENABLED:
        return

    try:
        chunks = chunk_transcript(transcript)
        if not chunks:
            logger.debug("No chunks produced for video %s", video_id)
            return

        texts = [c["text"] for c in chunks]
        # Run CPU-heavy embedding in thread pool to avoid blocking event loop
        embeddings = await asyncio.to_thread(embed_texts, texts)

        service = _get_vector_service()
        # Run synchronous Qdrant I/O in thread pool
        success = await asyncio.to_thread(service.store_chunks, video_id, chunks, embeddings)

        if success:
            logger.info(
                "Stored %d transcript chunks for video %s", len(chunks), video_id,
            )
        else:
            logger.warning("Failed to store chunks for video %s", video_id)

    except Exception as e:
        logger.warning(
            "Background chunk storage failed for %s: %s", video_id, e,
        )
