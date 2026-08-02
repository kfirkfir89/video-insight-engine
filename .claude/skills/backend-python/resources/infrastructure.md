# Infrastructure Patterns

Redis caching, RabbitMQ worker (aio-pika), Docker, health checks, and configuration.

<rules>
- ALWAYS set TTL on every cache key (keys without expiry accumulate forever, eventually exhausting Redis memory)
- ALWAYS invalidate cache on writes — set, then delete related keys (stale cache causes users to see outdated data indefinitely)
- ALWAYS leave a consumed message in a terminal state — ack, or reject(requeue=False) so it lands in the DLQ (an unhandled exception without reject leaves messages unacked and redelivered forever)
- ALWAYS use Pydantic `BaseSettings` for configuration with env file support (manual os.environ parsing misses validation and type coercion)
- ALWAYS run containers as non-root user in Dockerfile (root in containers enables privilege escalation attacks)
- NEVER cache without an invalidation strategy (cache-only patterns guarantee stale data)
</rules>

---

## Redis Caching

```python
class CacheService:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def get(self, key: str) -> dict | None:
        data = await self._redis.get(key)
        return json.loads(data) if data else None

    async def set(self, key: str, value: dict, ttl: int = 3600) -> None:
        await self._redis.setex(key, ttl, json.dumps(value, default=str))

    async def delete(self, key: str) -> None:
        await self._redis.delete(key)

    async def delete_pattern(self, pattern: str) -> None:
        keys = [k async for k in self._redis.scan_iter(pattern)]
        if keys:
            await self._redis.delete(*keys)
```

---

## RabbitMQ Worker (aio-pika)

The summarizer worker (`services/summarizer/src/worker/`) consumes video jobs
published by vie-api. The real patterns:

- **Topology mirroring** (`topology.py`): queue/exchange/DLX/DLQ arguments
  mirror `api/src/services/queue-topology.ts` exactly — RabbitMQ rejects
  assertions that disagree on queue arguments, so any drift between publisher
  and consumer breaks startup.
- **Terminal states** (`runner.py`): every message exits acked or rejected:
  - Validation error → `reject(requeue=False)` → DLX → DLQ
  - Retriable pipeline error with attempts left → publish a NEW retry message
    (attempt+1, with backoff), then `ack()` the original
  - Pipeline error at `attempt >= max_retries` → `reject(requeue=False)` → DLQ
  - Success → `ack()`
- **Log correlation**: request/video ids are bound on the structlog contextvar
  stack so every line in a job is correlated.

```python
async with message.process(ignore_processed=True):
    payload = VideoJobPayload.model_validate_json(message.body)  # reject on failure
    ...
```

Use FastAPI `BackgroundTasks` for simple same-process work. Use the RabbitMQ
worker for distributed, retriable jobs (gated by `USE_QUEUE_PIPELINE`).

---

## Health Checks

Implement `/health` (full check), `/health/live` (process alive), and `/health/ready` (dependencies connected).

```python
@router.get("/health")
async def health_check(db: Annotated[AsyncIOMotorDatabase, Depends(get_database)]) -> dict:
    try:
        await db.command("ping")
        return {"status": "healthy", "services": {"mongodb": "connected"}}
    except Exception:
        return {"status": "unhealthy", "services": {"mongodb": "disconnected"}}
```

---

## Configuration

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
    APP_NAME: str = "API"
    DEBUG: bool = False
    MONGODB_URI: str
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str
```

---

## Docker

Use multi-stage builds: builder installs dependencies, production image copies only packages. Create non-root user. Expose only the app port.

```dockerfile
FROM python:3.12-slim AS builder
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-dev

FROM python:3.12-slim
RUN useradd -m -u 1000 appuser
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .
USER appuser
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Edge Cases

- **Redis connection in tests**: Use `fakeredis` for unit tests. For integration tests, use a separate Redis database index (`/1`).
- **Retry is a new message**: the worker retries by publishing a fresh message with `attempt + 1` and acking the original — never `requeue=True` (which would retry instantly with no backoff and no attempt counter).
- **Docker healthcheck timing**: Set `interval: 30s` with `retries: 3`. Initial startup may need `start_period: 10s` to avoid premature restarts.

---

## Rules Summary

Cache with TTL and explicit invalidation on writes. Consume RabbitMQ messages with aio-pika, keep topology mirrored with the API publisher, and leave every message in a terminal state (ack or reject-to-DLQ; retries are new messages with attempt+1). Use Pydantic BaseSettings for type-safe configuration from environment. Implement three-tier health checks for orchestration. Build Docker images with multi-stage builds and non-root users. Use BackgroundTasks for simple work, the queue worker for distributed retriable jobs.
