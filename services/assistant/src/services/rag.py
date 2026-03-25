"""RAG service for semantic search over transcript chunks."""

from __future__ import annotations

import asyncio
from typing import Any

import numpy as np

from src.logging_config import get_logger
from src.models.responses import RAGSource
from src.repositories.qdrant_repository import QdrantRepository

logger = get_logger(__name__)

_DEDUP_SIMILARITY_THRESHOLD = 0.95


class RAGService:
    """Retrieval-augmented generation over video transcript chunks."""

    def __init__(
        self,
        qdrant_repo: QdrantRepository,
        model_name: str = "all-MiniLM-L6-v2",
    ) -> None:
        self._qdrant_repo = qdrant_repo
        self._model_name = model_name
        self._embedding_model: Any = None

    def _get_model(self) -> Any:
        """Lazy-load the sentence-transformers model."""
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer

            self._embedding_model = SentenceTransformer(self._model_name)
        return self._embedding_model

    def _encode(self, text: str) -> list[float]:
        """Encode text to embedding vector (blocking call)."""
        model = self._get_model()
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    async def search(
        self,
        query: str,
        video_id: str,
        top_k: int = 8,
    ) -> list[RAGSource]:
        """Search for relevant transcript chunks.

        Args:
            query: User query text.
            video_id: Video to search within.
            top_k: Maximum number of results.

        Returns:
            Deduplicated list of RAGSource objects sorted by relevance.
        """
        try:
            query_vector = await asyncio.to_thread(self._encode, query)
            results = await asyncio.to_thread(
                self._qdrant_repo.search,
                query_vector=query_vector,
                video_id=video_id,
                top_k=top_k,
            )

            sources = [
                RAGSource(
                    text=r["text"],
                    timestamp=r.get("timestamp"),
                    score=r.get("score", 0.0),
                    chunk_index=r.get("chunk_index", 0),
                )
                for r in results
            ]

            return await self._deduplicate(sources)
        except Exception as exc:
            logger.warning(
                "rag_search_failed_degraded_mode",
                video_id=video_id,
                error=str(exc),
            )
            return []

    async def _deduplicate(self, sources: list[RAGSource]) -> list[RAGSource]:
        """Remove near-duplicate chunks using cosine similarity.

        Chunks with cosine similarity > threshold are considered duplicates;
        only the highest-scoring one is kept.
        """
        if len(sources) <= 1:
            return sources

        try:
            texts = [s.text for s in sources]
            embeddings = await asyncio.to_thread(
                self._get_model().encode, texts, convert_to_numpy=True
            )

            # Normalize for cosine similarity
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1, norms)
            normalized = embeddings / norms

            keep_indices: list[int] = []
            for i in range(len(sources)):
                is_duplicate = False
                for j in keep_indices:
                    similarity = float(np.dot(normalized[i], normalized[j]))
                    if similarity > _DEDUP_SIMILARITY_THRESHOLD:
                        is_duplicate = True
                        break
                if not is_duplicate:
                    keep_indices.append(i)

            return [sources[i] for i in keep_indices]
        except Exception:
            logger.warning("rag_dedup_failed_returning_all")
            return sources

    async def preload_model(self) -> None:
        """Preload the embedding model at startup."""
        await asyncio.to_thread(self._get_model)
