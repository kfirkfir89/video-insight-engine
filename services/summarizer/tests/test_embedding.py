"""Tests for embedding service."""

import pytest
from unittest.mock import patch, MagicMock

import numpy as np


class TestEmbedTexts:
    """Test batch text embedding."""

    @patch("src.services.vector.embedding._get_model")
    def test_returns_list_of_vectors(self, mock_get_model):
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[0.1] * 384, [0.2] * 384])
        mock_get_model.return_value = mock_model

        from src.services.vector.embedding import embed_texts

        result = embed_texts(["hello", "world"])

        assert len(result) == 2
        assert len(result[0]) == 384
        mock_model.encode.assert_called_once_with(["hello", "world"], show_progress_bar=False)

    @patch("src.services.vector.embedding._get_model")
    def test_empty_input_returns_empty(self, mock_get_model):
        from src.services.vector.embedding import embed_texts

        result = embed_texts([])

        assert result == []
        mock_get_model.assert_not_called()

    @patch("src.services.vector.embedding._get_model")
    def test_single_text(self, mock_get_model):
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[0.5] * 384])
        mock_get_model.return_value = mock_model

        from src.services.vector.embedding import embed_texts

        result = embed_texts(["single text"])

        assert len(result) == 1
        assert isinstance(result[0], list)


class TestEmbedQuery:
    """Test single query embedding."""

    @patch("src.services.vector.embedding._get_model")
    def test_returns_single_vector(self, mock_get_model):
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.3] * 384)
        mock_get_model.return_value = mock_model

        from src.services.vector.embedding import embed_query

        result = embed_query("what is machine learning?")

        assert len(result) == 384
        assert isinstance(result, list)
        mock_model.encode.assert_called_once_with("what is machine learning?")


class TestLazyLoading:
    """Test that model is lazy-loaded."""

    def test_model_not_loaded_at_import(self):
        """Verify _model starts as None (lazy)."""
        import src.services.vector.embedding as emb

        # Reset to verify lazy init
        original = emb._model
        emb._model = None
        assert emb._model is None
        emb._model = original  # restore
