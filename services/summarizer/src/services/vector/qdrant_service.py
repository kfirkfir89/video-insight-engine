"""Qdrant vector service for transcript chunk storage and retrieval.

Provides semantic search over transcript chunks using cosine similarity.
Gracefully degrades if Qdrant is unavailable — pipeline continues without vector storage.
"""

import hashlib
import logging

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from src.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "transcript_chunks"
VECTOR_SIZE = 384  # all-MiniLM-L6-v2


class VectorService:
    """Store and search transcript chunks in Qdrant."""

    def __init__(self, host: str | None = None, port: int | None = None) -> None:
        self._host = host or settings.QDRANT_HOST
        self._port = port or settings.QDRANT_PORT
        self._client: QdrantClient | None = None

    def _get_client(self) -> QdrantClient:
        """Lazy-initialize Qdrant client."""
        if self._client is None:
            self._client = QdrantClient(host=self._host, port=self._port, timeout=5.0)
        return self._client

    def _ensure_collection(self) -> bool:
        """Create collection if it doesn't exist. Returns True on success."""
        try:
            client = self._get_client()
            collections = client.get_collections().collections
            if not any(c.name == COLLECTION_NAME for c in collections):
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(
                        size=VECTOR_SIZE,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info("Created Qdrant collection: %s", COLLECTION_NAME)
            return True
        except Exception as e:
            logger.warning("Qdrant collection setup failed: %s", e)
            return False

    def store_chunks(
        self,
        video_id: str,
        chunks: list[dict],
        embeddings: list[list[float]],
    ) -> bool:
        """Store transcript chunks with embeddings. Returns True on success."""
        if not self._ensure_collection():
            return False

        try:
            points = [
                PointStruct(
                    id=int.from_bytes(
                        hashlib.sha256(f"{video_id}_{i}".encode()).digest()[:8], "big",
                    ) & 0x7FFFFFFFFFFFFFFF,
                    vector=emb,
                    payload={
                        "video_id": video_id,
                        "chunk_index": i,
                        "text": chunk["text"],
                        "start_char": chunk.get("start_char", 0),
                        "end_char": chunk.get("end_char", 0),
                    },
                )
                for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
            ]
            self._get_client().upsert(
                collection_name=COLLECTION_NAME, points=points,
            )
            logger.info(
                "Stored %d chunks for video %s in Qdrant", len(points), video_id,
            )
            return True
        except Exception as e:
            logger.warning("Qdrant store_chunks failed for %s: %s", video_id, e)
            return False

    def search(
        self,
        query_embedding: list[float],
        video_id: str | None = None,
        limit: int = 5,
    ) -> list[dict]:
        """Search transcript chunks by similarity. Returns empty list on failure."""
        try:
            query_filter = None
            if video_id:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="video_id", match=MatchValue(value=video_id),
                        ),
                    ],
                )

            results = self._get_client().search(
                collection_name=COLLECTION_NAME,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=limit,
            )
            return [
                {
                    "text": r.payload["text"],
                    "video_id": r.payload["video_id"],
                    "score": r.score,
                    "chunk_index": r.payload["chunk_index"],
                }
                for r in results
            ]
        except Exception as e:
            logger.warning("Qdrant search failed: %s", e)
            return []

    def search_multi_video(
        self,
        query_embedding: list[float],
        video_ids: list[str],
        limit: int = 10,
    ) -> list[dict]:
        """Search across multiple videos (for collection-level queries)."""
        try:
            query_filter = Filter(
                should=[
                    FieldCondition(
                        key="video_id", match=MatchValue(value=vid),
                    )
                    for vid in video_ids
                ],
            )
            results = self._get_client().search(
                collection_name=COLLECTION_NAME,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=limit,
            )
            return [
                {
                    "text": r.payload["text"],
                    "video_id": r.payload["video_id"],
                    "score": r.score,
                    "chunk_index": r.payload["chunk_index"],
                }
                for r in results
            ]
        except Exception as e:
            logger.warning("Qdrant multi-video search failed: %s", e)
            return []

    def delete_video(self, video_id: str) -> bool:
        """Delete all chunks for a video. Returns True on success."""
        try:
            self._get_client().delete(
                collection_name=COLLECTION_NAME,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="video_id", match=MatchValue(value=video_id),
                        ),
                    ],
                ),
            )
            logger.info("Deleted Qdrant chunks for video %s", video_id)
            return True
        except Exception as e:
            logger.warning("Qdrant delete_video failed for %s: %s", video_id, e)
            return False
