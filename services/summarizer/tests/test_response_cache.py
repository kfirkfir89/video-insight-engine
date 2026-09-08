"""Tests for Redis response cache service."""

import json
import pytest
from unittest.mock import AsyncMock

from src.config import settings
from src.services.cache.response_cache import ResponseCache

# Cache keys are namespaced by PIPELINE_VERSION (interactive-overhaul-v2 1D) so
# a schema bump auto-invalidates stale docs. Derive the expected key from
# settings so a future version bump doesn't break these tests.
_KEY = f"vie:response:{settings.PIPELINE_VERSION}:video123"


class TestResponseCache:
    """Test ResponseCache with mocked async Redis."""

    @pytest.fixture
    def mock_redis(self):
        return AsyncMock()

    @pytest.fixture
    def cache(self, mock_redis):
        c = ResponseCache(redis_url="redis://localhost:6379")
        c._client = mock_redis
        return c

    @pytest.mark.asyncio
    async def test_get_response_hit(self, cache, mock_redis):
        data = {"meta": {"title": "Test"}, "tabs": []}
        mock_redis.get.return_value = json.dumps(data)

        result = await cache.get_response("video123")

        assert result == data
        mock_redis.get.assert_called_once_with(_KEY)

    @pytest.mark.asyncio
    async def test_get_response_miss(self, cache, mock_redis):
        mock_redis.get.return_value = None

        result = await cache.get_response("video123")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_response_connection_error(self, cache, mock_redis):
        import redis.asyncio as aioredis

        mock_redis.get.side_effect = aioredis.ConnectionError("Connection refused")

        result = await cache.get_response("video123")

        assert result is None

    @pytest.mark.asyncio
    async def test_set_response_success(self, cache, mock_redis):
        data = {"meta": {"title": "Test"}, "tabs": []}

        result = await cache.set_response("video123", data)

        assert result is True
        mock_redis.set.assert_called_once()
        call_args = mock_redis.set.call_args
        assert call_args[0][0] == _KEY

    @pytest.mark.asyncio
    async def test_set_response_connection_error(self, cache, mock_redis):
        import redis.asyncio as aioredis

        mock_redis.set.side_effect = aioredis.ConnectionError("Connection refused")

        result = await cache.set_response("video123", {"test": True})

        assert result is False

    @pytest.mark.asyncio
    async def test_set_response_default_safe_keys_includes_language_fields(self, cache, mock_redis):
        """Non-English videos must round-trip ``language``/``isRTL``/``sourceLanguage``.

        Without these in the default allowlist, the FE language toggle never
        renders for cached non-English videos — the translation phase's work
        is dropped on the Redis write boundary.
        """
        data = {
            "meta": {"title": "Test"},
            "tabs": [],
            "language": "en",
            "isRTL": False,
            "sourceLanguage": {
                "code": "he",
                "name": "עברית",
                "isRTL": True,
                "tabs": [],
                "meta": {},
            },
            "internalDebugField": "should be dropped",
        }

        await cache.set_response("video123", data)

        call_args = mock_redis.set.call_args
        cached = json.loads(call_args[0][1])
        assert "language" in cached
        assert "isRTL" in cached
        assert "sourceLanguage" in cached
        assert cached["sourceLanguage"]["code"] == "he"
        assert "internalDebugField" not in cached

    @pytest.mark.asyncio
    async def test_set_response_drops_transcript_meta(self, cache, mock_redis):
        """``transcriptMeta`` is Mongo-only observability.

        The Redis payload is served straight to the FE on a cache hit, so
        the allowlist must keep dropping it even though the Mongo doc now
        carries it.
        """
        data = {
            "meta": {"title": "Test"},
            "tabs": [],
            "transcriptMeta": {"outcome": "ok", "source": "ytdlp"},
        }

        await cache.set_response("video123", data)

        cached = json.loads(mock_redis.set.call_args[0][1])
        assert "transcriptMeta" not in cached
        assert "meta" in cached

    @pytest.mark.asyncio
    async def test_invalidate_success(self, cache, mock_redis):
        result = await cache.invalidate("video123")

        assert result is True
        mock_redis.delete.assert_called_once_with(_KEY)

    @pytest.mark.asyncio
    async def test_exists_true(self, cache, mock_redis):
        mock_redis.exists.return_value = 1

        assert await cache.exists("video123") is True

    @pytest.mark.asyncio
    async def test_exists_false(self, cache, mock_redis):
        mock_redis.exists.return_value = 0

        assert await cache.exists("video123") is False

    @pytest.mark.asyncio
    async def test_exists_error_returns_false(self, cache, mock_redis):
        import redis.asyncio as aioredis

        mock_redis.exists.side_effect = aioredis.RedisError("Redis down")

        assert await cache.exists("video123") is False
