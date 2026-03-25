"""Qdrant repository for searching transcript chunks."""

from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.models import (
    FieldCondition,
    Filter,
    MatchValue,
)

from src.logging_config import get_logger

logger = get_logger(__name__)


class QdrantRepository:
    """Search transcript chunks stored in Qdrant vector database."""

    def __init__(self, url: str, collection: str) -> None:
        self._url = url
        self._collection = collection
        self._client: QdrantClient | None = None

    def _get_client(self) -> QdrantClient:
        """Lazy-initialize Qdrant client."""
        if self._client is None:
            self._client = QdrantClient(url=self._url, timeout=5)
        return self._client

    def search(
        self,
        query_vector: list[float],
        video_id: str,
        top_k: int = 8,
    ) -> list[dict]:
        """Search transcript chunks by vector similarity.

        Args:
            query_vector: Embedding vector for the query.
            video_id: Filter results to this video.
            top_k: Maximum number of results to return.

        Returns:
            List of dicts with text, video_id, score, chunk_index, and
            timestamp (if available). Returns empty list on failure.
        """
        try:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="video_id",
                        match=MatchValue(value=video_id),
                    ),
                ],
            )

            results = self._get_client().search(
                collection_name=self._collection,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k,
            )

            return [
                {
                    "text": r.payload.get("text", ""),
                    "video_id": r.payload.get("video_id", ""),
                    "score": r.score,
                    "chunk_index": r.payload.get("chunk_index", 0),
                    "timestamp": r.payload.get("timestamp"),
                }
                for r in results
                if r.payload
            ]
        except Exception:
            logger.exception("qdrant_search_failed", video_id=video_id)
            return []
