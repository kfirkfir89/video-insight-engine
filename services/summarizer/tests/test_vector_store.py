"""Tests for vector store background task."""

import asyncio
import pytest
from unittest.mock import patch, MagicMock

from src.services.vector.store import store_transcript_chunks


class TestStoreTranscriptChunks:
    """Test the background store pipeline."""

    @patch("src.services.vector.store.settings")
    def test_skips_when_disabled(self, mock_settings):
        mock_settings.QDRANT_ENABLED = False

        # Should return without doing anything
        asyncio.get_event_loop().run_until_complete(
            store_transcript_chunks("video123", "Some transcript text.")
        )

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    def test_chunks_embeds_and_stores(
        self, mock_settings, mock_chunk, mock_embed, mock_get_svc,
    ):
        mock_settings.QDRANT_ENABLED = True
        mock_chunk.return_value = [
            {"text": "chunk 1", "start_char": 0, "end_char": 7},
            {"text": "chunk 2", "start_char": 8, "end_char": 15},
        ]
        mock_embed.return_value = [[0.1] * 384, [0.2] * 384]
        mock_svc = MagicMock()
        mock_svc.store_chunks.return_value = True
        mock_get_svc.return_value = mock_svc

        asyncio.get_event_loop().run_until_complete(
            store_transcript_chunks("video123", "Some transcript text.")
        )

        mock_chunk.assert_called_once()
        mock_embed.assert_called_once_with(["chunk 1", "chunk 2"])
        mock_svc.store_chunks.assert_called_once()

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    def test_empty_chunks_skips_storage(
        self, mock_settings, mock_chunk, mock_embed, mock_get_svc,
    ):
        mock_settings.QDRANT_ENABLED = True
        mock_chunk.return_value = []

        asyncio.get_event_loop().run_until_complete(
            store_transcript_chunks("video123", "")
        )

        mock_embed.assert_not_called()

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    def test_handles_exception_gracefully(
        self, mock_settings, mock_chunk, mock_embed, mock_get_svc,
    ):
        mock_settings.QDRANT_ENABLED = True
        mock_chunk.side_effect = Exception("boom")

        # Should not raise
        asyncio.get_event_loop().run_until_complete(
            store_transcript_chunks("video123", "text")
        )
