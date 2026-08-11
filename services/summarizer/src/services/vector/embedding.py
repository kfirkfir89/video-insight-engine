"""Generate embeddings for transcript chunks using SentenceTransformer.

Default model: all-MiniLM-L6-v2 (384-dim, fast, good quality for semantic search).
Configurable via ``settings.EMBEDDING_MODEL_NAME`` — drop-in replacements must
keep the 384-dim vector size (e.g. ``BAAI/bge-small-en-v1.5``).
Lazy-loaded to avoid ~500MB memory hit on import.
"""

from __future__ import annotations

import logging

from src.config import settings

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    """Lazy-load SentenceTransformer model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        model_name = settings.EMBEDDING_MODEL_NAME
        _model = SentenceTransformer(model_name)
        logger.info("Loaded SentenceTransformer model: %s", model_name)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts. Returns list of 384-dim vectors."""
    if not texts:
        return []
    model = _get_model()
    return model.encode(texts, show_progress_bar=False).tolist()


def embed_query(query: str) -> list[float]:
    """Embed a single query string. Returns 384-dim vector."""
    model = _get_model()
    return model.encode(query).tolist()
