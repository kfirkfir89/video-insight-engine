"""Tests for vector store background tasks."""

from __future__ import annotations

from unittest.mock import patch, MagicMock

from src.services.vector.store import (
    store_default_output_chunks,
    store_transcript_chunks,
)


class TestStoreTranscriptChunks:
    """Test the transcript chunk background pipeline."""

    @patch("src.services.vector.store.settings")
    async def test_skips_when_disabled(self, mock_settings):
        mock_settings.QDRANT_ENABLED = False

        await store_transcript_chunks("video123", "Some transcript text.")

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    async def test_chunks_embeds_and_stores(
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

        await store_transcript_chunks("video123", "Some transcript text.")

        mock_chunk.assert_called_once()
        mock_embed.assert_called_once_with(["chunk 1", "chunk 2"])
        mock_svc.store_chunks.assert_called_once()

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    async def test_pre_deletes_before_upsert(
        self, mock_settings, mock_chunk, mock_embed, mock_get_svc,
    ):
        """Pre-delete must happen before upsert so reprocesses with fewer
        chunks don't leave orphan points behind."""
        mock_settings.QDRANT_ENABLED = True
        mock_chunk.return_value = [{"text": "chunk", "start_char": 0, "end_char": 5}]
        mock_embed.return_value = [[0.1] * 384]

        call_order: list[str] = []
        mock_svc = MagicMock()
        mock_svc.delete_by_video_and_source.side_effect = (
            lambda *_a, **_kw: call_order.append("delete")
        )
        mock_svc.store_chunks.side_effect = lambda *_a, **_kw: (
            call_order.append("store") or True
        )
        mock_get_svc.return_value = mock_svc

        await store_transcript_chunks("video123", "text")

        assert call_order == ["delete", "store"]
        # The delete must scope to ``transcript`` source.
        delete_call = mock_svc.delete_by_video_and_source.call_args
        args = delete_call.args
        assert args[0] == "video123"
        assert args[1] == "transcript"

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    async def test_empty_chunks_skips_storage(
        self, mock_settings, mock_chunk, mock_embed, mock_get_svc,
    ):
        mock_settings.QDRANT_ENABLED = True
        mock_chunk.return_value = []

        await store_transcript_chunks("video123", "")

        mock_embed.assert_not_called()

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.chunk_transcript")
    @patch("src.services.vector.store.settings")
    async def test_handles_exception_gracefully(
        self, mock_settings, mock_chunk, mock_embed, mock_get_svc,
    ):
        mock_settings.QDRANT_ENABLED = True
        mock_chunk.side_effect = Exception("boom")

        # Should not raise
        await store_transcript_chunks("video123", "text")


class TestStoreDefaultOutputChunks:
    """Test the assembled-output chunk background pipeline."""

    @patch("src.services.vector.store.settings")
    async def test_skips_when_disabled(self, mock_settings):
        mock_settings.QDRANT_ENABLED = False

        await store_default_output_chunks(
            "video123", [{"id": "x", "component": "overview", "props": {}}]
        )

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.settings")
    async def test_pre_deletes_before_upsert(self, mock_settings, mock_embed, mock_get_svc):
        mock_settings.QDRANT_ENABLED = True
        mock_embed.return_value = [[0.1] * 384]

        call_order: list[str] = []
        mock_svc = MagicMock()
        mock_svc.delete_by_video_and_source.side_effect = (
            lambda *_a, **_kw: call_order.append("delete")
        )
        mock_svc.store_chunks.side_effect = lambda *_a, **_kw: (
            call_order.append("store") or True
        )
        mock_get_svc.return_value = mock_svc

        tabs = [
            {
                "id": "overview_tab",
                "component": "overview",
                "props": {
                    "masterSummary": "A long enough sentence that crosses the six word minimum bar.",
                },
            },
        ]

        await store_default_output_chunks("video123", tabs)

        assert call_order[0] == "delete"
        assert "store" in call_order
        # Pre-delete must scope to "default_output".
        delete_call = mock_svc.delete_by_video_and_source.call_args
        args = delete_call.args
        assert args[0] == "video123"
        assert args[1] == "default_output"

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.settings")
    async def test_empty_tabs_pre_delete_only(self, mock_settings, mock_embed, mock_get_svc):
        """When chunker yields nothing, still pre-delete to clean up old points."""
        mock_settings.QDRANT_ENABLED = True
        mock_svc = MagicMock()
        mock_get_svc.return_value = mock_svc

        await store_default_output_chunks("video123", [])

        mock_svc.delete_by_video_and_source.assert_called_once_with(
            "video123", "default_output",
        )
        mock_svc.store_chunks.assert_not_called()
        mock_embed.assert_not_called()

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.settings")
    async def test_handles_chunker_exception_gracefully(
        self, mock_settings, mock_embed, mock_get_svc,
    ):
        mock_settings.QDRANT_ENABLED = True
        mock_get_svc.return_value = MagicMock()

        with patch(
            "src.services.vector.store.chunk_assembled_tabs",
            side_effect=Exception("boom"),
        ):
            # Must not raise.
            await store_default_output_chunks(
                "video123", [{"id": "x", "component": "overview", "props": {}}]
            )

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.settings")
    async def test_pre_delete_runs_even_when_chunker_raises(
        self, mock_settings, mock_embed, mock_get_svc,
    ):
        """Regression: chunker exception must NOT strand orphan output chunks
        — pre-delete fires before chunking so prior runs are always cleaned up."""
        mock_settings.QDRANT_ENABLED = True
        mock_svc = MagicMock()
        mock_get_svc.return_value = mock_svc

        with patch(
            "src.services.vector.store.chunk_assembled_tabs",
            side_effect=Exception("boom"),
        ):
            await store_default_output_chunks(
                "video123", [{"id": "x", "component": "overview", "props": {}}]
            )

        mock_svc.delete_by_video_and_source.assert_called_once_with(
            "video123", "default_output",
        )

    @patch("src.services.vector.store._get_vector_service")
    @patch("src.services.vector.store.embed_texts")
    @patch("src.services.vector.store.settings")
    async def test_batches_chunks_into_single_upsert(self, mock_settings, mock_embed, mock_get_svc):
        """Chunks from multiple tabs are batched into ONE store_chunks call
        (not one call per tab) — saves N HTTP round-trips per pipeline run."""
        mock_settings.QDRANT_ENABLED = True
        mock_embed.return_value = [[0.1] * 384, [0.2] * 384]
        mock_svc = MagicMock()
        mock_svc.store_chunks.return_value = True
        mock_get_svc.return_value = mock_svc

        tabs = [
            {
                "id": "overview_tab",
                "component": "overview",
                "props": {"masterSummary": "Long enough overview summary text crossing six words easily."},
            },
            {
                "id": "checklist_tab",
                "component": "checklist",
                "props": {"items": [{"label": "Long enough checklist label text crossing six words"}]},
            },
        ]

        await store_default_output_chunks("video123", tabs)

        # Single batched call across all tabs — per-chunk tab metadata
        # supplied via tab_ids/tab_components kwargs.
        assert mock_svc.store_chunks.call_count == 1
        call = mock_svc.store_chunks.call_args
        # Positional args: (video_id, chunks, embeddings, language,
        #                   original_chunks, source, tab_id, tab_component,
        #                   prop_paths, tab_ids, tab_components)
        tab_ids = call.args[9]
        tab_components = call.args[10]
        assert sorted(tab_ids) == ["checklist_tab", "overview_tab"]
        assert sorted(tab_components) == ["checklist", "overview"]
