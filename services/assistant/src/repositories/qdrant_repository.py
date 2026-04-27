"""Qdrant repository for searching transcript and output chunks."""

from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.models import (
    FieldCondition,
    Filter,
    MatchAny,
    MatchValue,
)

from src.logging_config import get_logger

logger = get_logger(__name__)


class QdrantRepository:
    """Search transcript + output chunks stored in Qdrant vector database."""

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
        video_ids: list[str],
        top_k: int = 8,
        sources: list[str] | None = None,
    ) -> list[dict]:
        """Search vector chunks by similarity.

        Args:
            query_vector: Embedding vector for the query.
            video_ids: Filter results to these videos. Single-element lists
                use ``MatchValue`` (cheaper); multi-element lists use
                ``MatchAny``.
            top_k: Maximum number of results to return.
            sources: Optional filter to ``source`` payload values
                (e.g. ``["transcript", "default_output"]``). When ``None``,
                all sources are returned.

        Returns:
            List of dicts with text, video_id, score, chunk_index, timestamp,
            source, tab_id, tab_component, prop_path. Returns empty list on
            failure.
        """
        if not video_ids:
            return []

        try:
            conditions: list = []
            if len(video_ids) == 1:
                conditions.append(
                    FieldCondition(
                        key="video_id",
                        match=MatchValue(value=video_ids[0]),
                    ),
                )
            else:
                conditions.append(
                    FieldCondition(
                        key="video_id",
                        match=MatchAny(any=video_ids),
                    ),
                )
            if sources:
                conditions.append(
                    FieldCondition(
                        key="source",
                        match=MatchAny(any=sources),
                    ),
                )

            response = self._get_client().query_points(
                collection_name=self._collection,
                query=query_vector,
                query_filter=Filter(must=conditions),
                limit=top_k,
            )

            return [
                {
                    "text": r.payload.get("text", ""),
                    "text_original": r.payload.get("text_original"),
                    "video_id": r.payload.get("video_id", ""),
                    "score": r.score,
                    "chunk_index": r.payload.get("chunk_index", 0),
                    "timestamp": r.payload.get("timestamp"),
                    "source": r.payload.get("source", "transcript"),
                    "tab_id": r.payload.get("tab_id"),
                    "tab_component": r.payload.get("tab_component"),
                    "prop_path": r.payload.get("prop_path"),
                }
                for r in response.points
                if r.payload
            ]
        except Exception:
            logger.exception("qdrant_search_failed", video_ids=video_ids)
            return []
