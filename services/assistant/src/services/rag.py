"""RAG service for semantic search over transcript and output chunks."""

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
    """Retrieval-augmented generation over video transcript + output chunks."""

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
        sources: list[str] | None = None,
    ) -> list[RAGSource]:
        """Search for relevant chunks within a single video.

        Args:
            query: User query text.
            video_id: Video to search within.
            top_k: Maximum number of results.
            sources: Optional source filter (``["transcript"]``,
                ``["default_output"]``, or both). ``None`` returns all sources.

        Returns:
            Deduplicated list of RAGSource objects sorted by relevance.
        """
        try:
            query_vector = await asyncio.to_thread(self._encode, query)
            results = await asyncio.to_thread(
                self._qdrant_repo.search,
                query_vector=query_vector,
                video_ids=[video_id],
                top_k=top_k,
                sources=sources,
            )

            sources_list = [_result_to_source(r) for r in results]
            return await self._deduplicate(sources_list)
        except Exception as exc:
            logger.warning(
                "rag_search_failed_degraded_mode",
                video_id=video_id,
                error=str(exc),
            )
            return []

    async def search_library(
        self,
        query: str,
        video_ids: list[str],
        top_k: int = 10,
        sources: list[str] | None = None,
    ) -> list[RAGSource]:
        """Search for relevant chunks across multiple videos.

        Args:
            query: User query text.
            video_ids: Library scope to search across. Empty list returns
                ``[]`` without contacting Qdrant.
            top_k: Maximum number of results.
            sources: Optional source filter (see ``search``).

        Returns:
            Deduplicated list of ``RAGSource`` with ``video_id`` populated so
            callers can group results by video.
        """
        if not video_ids:
            return []

        try:
            query_vector = await asyncio.to_thread(self._encode, query)
            results = await asyncio.to_thread(
                self._qdrant_repo.search,
                query_vector=query_vector,
                video_ids=video_ids,
                top_k=top_k,
                sources=sources,
            )

            sources_list = [_result_to_source(r) for r in results]
            return await self._deduplicate(sources_list)
        except Exception as exc:
            logger.warning(
                "rag_library_search_failed",
                video_ids=video_ids,
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


def _result_to_source(r: dict) -> RAGSource:
    """Map a Qdrant repository dict to a ``RAGSource``."""
    return RAGSource(
        text=r.get("text", ""),
        text_original=r.get("text_original"),
        timestamp=r.get("timestamp"),
        score=float(r.get("score", 0.0)),
        chunk_index=int(r.get("chunk_index", 0)),
        video_id=r.get("video_id", ""),
        source=r.get("source", "transcript"),
        tab_id=r.get("tab_id"),
        tab_component=r.get("tab_component"),
        prop_path=r.get("prop_path"),
    )
