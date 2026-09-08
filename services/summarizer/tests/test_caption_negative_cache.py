"""Tests for the caption-endpoint 429 negative cache."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import redis.asyncio as aioredis

from src.services.cache import caption_negative_cache as cnc_module
from src.services.cache.caption_negative_cache import CaptionNegativeCache


def _cache_with_client(client: AsyncMock) -> CaptionNegativeCache:
    cache = CaptionNegativeCache(redis_url="redis://test:6379")
    cache._client = client
    return cache


class TestMark:
    async def test_mark_sets_key_with_ttl(self):
        """mark() writes the global key with the configured TTL."""
        client = AsyncMock()
        cache = _cache_with_client(client)

        with patch.object(cnc_module.settings, "CAPTION_429_NEG_TTL_SECONDS", 900):
            await cache.mark()

        client.set.assert_awaited_once()
        args, kwargs = client.set.await_args
        assert args[0].startswith("vie:captions")
        assert kwargs["ex"] == 900

    async def test_ttl_kill_switch_disables_writes(self):
        """TTL <= 0 makes mark() a no-op (rollback lever)."""
        client = AsyncMock()
        cache = _cache_with_client(client)

        with patch.object(cnc_module.settings, "CAPTION_429_NEG_TTL_SECONDS", 0):
            await cache.mark()

        client.set.assert_not_awaited()

    async def test_mark_fail_open_on_connection_error(self):
        """Redis being down must never raise into the pipeline."""
        client = AsyncMock()
        client.set.side_effect = aioredis.ConnectionError("down")
        cache = _cache_with_client(client)

        with patch.object(cnc_module.settings, "CAPTION_429_NEG_TTL_SECONDS", 900):
            await cache.mark()  # must not raise


class TestIsMarked:
    async def test_true_when_key_exists(self):
        client = AsyncMock()
        client.exists.return_value = 1
        cache = _cache_with_client(client)

        assert await cache.is_marked() is True

    async def test_false_on_miss(self):
        client = AsyncMock()
        client.exists.return_value = 0
        cache = _cache_with_client(client)

        assert await cache.is_marked() is False

    async def test_fail_open_on_connection_error(self):
        """Redis errors read as 'not marked' — the pipeline proceeds normally."""
        client = AsyncMock()
        client.exists.side_effect = aioredis.ConnectionError("down")
        cache = _cache_with_client(client)

        assert await cache.is_marked() is False

    async def test_fail_open_on_redis_error(self):
        client = AsyncMock()
        client.exists.side_effect = aioredis.RedisError("weird")
        cache = _cache_with_client(client)

        assert await cache.is_marked() is False


class TestClose:
    async def test_close_resets_client(self):
        client = AsyncMock()
        cache = _cache_with_client(client)

        await cache.close()

        client.close.assert_awaited_once()
        assert cache._client is None
