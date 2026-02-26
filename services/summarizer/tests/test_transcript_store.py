"""Tests for transcript store service — S3 key generation and retrieval."""

from unittest.mock import AsyncMock, patch

import pytest

from src.services.transcript_store import TranscriptStoreService


@pytest.fixture
def store():
    """Create a fresh TranscriptStoreService with mocked S3 client."""
    with patch("src.services.transcript_store.s3_client") as mock_s3:
        service = TranscriptStoreService()
        service._s3 = mock_s3
        yield service, mock_s3


class TestKeyGeneration:
    """Tests for key path generation."""

    def test_new_key_format(self):
        store = TranscriptStoreService()
        assert store._get_key("dQw4w9WgXcQ") == "videos/dQw4w9WgXcQ/transcript.json"


class TestGet:
    """Tests for get() method."""

    @pytest.mark.asyncio
    async def test_get_found(self, store):
        service, mock_s3 = store
        mock_s3.get_json = AsyncMock(return_value={
            "youtube_id": "dQw4w9WgXcQ",
            "fetched_at": "2025-01-01T00:00:00Z",
            "source": "api",
            "language": "en",
            "segments": [{"text": "hello", "startMs": 0, "endMs": 1000}],
        })

        result = await service.get("dQw4w9WgXcQ")

        assert result is not None
        assert result.youtube_id == "dQw4w9WgXcQ"
        mock_s3.get_json.assert_awaited_once_with("videos/dQw4w9WgXcQ/transcript.json")

    @pytest.mark.asyncio
    async def test_get_not_found(self, store):
        service, mock_s3 = store
        mock_s3.get_json = AsyncMock(return_value=None)

        result = await service.get("nonexistent123")

        assert result is None
        mock_s3.get_json.assert_awaited_once_with("videos/nonexistent123/transcript.json")


class TestStore:
    """Tests for store() method."""

    @pytest.mark.asyncio
    async def test_store_uses_new_key(self, store):
        service, mock_s3 = store
        mock_s3.ensure_bucket_exists = AsyncMock()
        mock_s3.put_json = AsyncMock()

        with patch("src.services.transcript_store.S3Client.is_available", return_value=True):
            key = await service.store(
                youtube_id="dQw4w9WgXcQ",
                segments=[{"text": "hello", "startMs": 0, "endMs": 1000}],
                source="api",
                language="en",
            )

        assert key == "videos/dQw4w9WgXcQ/transcript.json"
        mock_s3.put_json.assert_awaited_once()
        call_args = mock_s3.put_json.call_args
        assert call_args[0][0] == "videos/dQw4w9WgXcQ/transcript.json"


class TestGetByRef:
    """Tests for get_by_ref() — reads exact key from MongoDB."""

    @pytest.mark.asyncio
    async def test_get_by_ref(self, store):
        service, mock_s3 = store
        mock_s3.get_json = AsyncMock(return_value={
            "youtube_id": "dQw4w9WgXcQ",
            "fetched_at": "2025-01-01T00:00:00Z",
            "source": "api",
            "language": "en",
            "segments": [],
        })

        result = await service.get_by_ref("videos/dQw4w9WgXcQ/transcript.json")

        assert result is not None
        mock_s3.get_json.assert_awaited_once_with("videos/dQw4w9WgXcQ/transcript.json")
