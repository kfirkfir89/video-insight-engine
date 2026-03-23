"""Tests for Redis response cache service."""

import json
import pytest
from unittest.mock import AsyncMock

from src.services.cache.response_cache import ResponseCache


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
        mock_redis.get.assert_called_once_with("vie:response:video123")

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
        assert call_args[0][0] == "vie:response:video123"

    @pytest.mark.asyncio
    async def test_set_response_connection_error(self, cache, mock_redis):
        import redis.asyncio as aioredis
        mock_redis.set.side_effect = aioredis.ConnectionError("Connection refused")

        result = await cache.set_response("video123", {"test": True})

        assert result is False

    @pytest.mark.asyncio
    async def test_invalidate_success(self, cache, mock_redis):
        result = await cache.invalidate("video123")

        assert result is True
        mock_redis.delete.assert_called_once_with("vie:response:video123")

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
