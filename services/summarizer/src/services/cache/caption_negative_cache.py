"""Short-TTL negative cache for YouTube caption-endpoint 429s.

YouTube rate-limits the timedtext/transcript endpoints per egress IP, not per
video — once one fetch 429s, every caption fetch in the window will too. This
marker lets subsequent pipeline runs skip the doomed caption calls (P2,
youtube-transcript-api) and go straight to the audio fallback, instead of
burning 30-60s of retries per run and amplifying the rate limit.

Scope trade-off (deliberate): a single spurious 429 routes ALL videos to paid
audio transcription for the TTL window. Accepted because the limit is
IP-scoped, the TTL is short, and the marker never gates P0 (S3 cached
transcript) or P1 (subtitles already fetched with the metadata).

Fail-open: any Redis error reads as "not marked" — the pipeline must never
depend on Redis availability. Kill switch: CAPTION_429_NEG_TTL_SECONDS <= 0
disables writes entirely.
"""

import logging

import redis.asyncio as aioredis

from src.config import settings

logger = logging.getLogger(__name__)

_KEY = "vie:captions:429"


class CaptionNegativeCache:
    """Global 'caption endpoints recently 429d' marker in Redis (async)."""

    def __init__(self, redis_url: str | None = None) -> None:
        self._url = redis_url or settings.REDIS_URL
        self._client: aioredis.Redis | None = None

    def _get_client(self) -> aioredis.Redis:
        """Lazy-initialize async Redis client."""
        if self._client is None:
            self._client = aioredis.from_url(
                self._url,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
                decode_responses=True,
            )
        return self._client

    async def mark(self) -> None:
        """Record that a caption endpoint just returned 429."""
        ttl = settings.CAPTION_429_NEG_TTL_SECONDS
        if ttl <= 0:  # kill switch
            return
        try:
            await self._get_client().set(_KEY, "1", ex=ttl)
            logger.info("Caption 429 negative-cached for %ds", ttl)
        except (aioredis.ConnectionError, aioredis.TimeoutError) as e:
            logger.debug("Redis mark failed: %s", e)
        except aioredis.RedisError as e:
            logger.warning("Redis mark unexpected error: %s", e)

    async def is_marked(self) -> bool:
        """True while a recent caption 429 is on record. False on any error."""
        try:
            return bool(await self._get_client().exists(_KEY))
        except (aioredis.ConnectionError, aioredis.TimeoutError) as e:
            logger.debug("Redis is_marked check failed: %s", e)
            return False
        except aioredis.RedisError as e:
            logger.warning("Redis is_marked unexpected error: %s", e)
            return False

    async def close(self) -> None:
        """Close the Redis connection pool."""
        if self._client:
            await self._client.close()
            self._client = None


# Module-level singleton (lazy-initialized)
caption_negative_cache = CaptionNegativeCache()
