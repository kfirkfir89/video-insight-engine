# Infrastructure Patterns

Redis caching, Celery tasks, message queues, and Docker.

---

## Redis Caching

### DO ✅

```python
import json
from typing import TypeVar, Generic
from redis.asyncio import Redis

T = TypeVar("T")


class CacheService:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis
        self._default_ttl = 3600

    async def get(self, key: str) -> dict | None:
        """Get value from cache."""
        data = await self._redis.get(key)
        return json.loads(data) if data else None

    async def set(self, key: str, value: dict, ttl: int | None = None) -> None:
        """Set value in cache."""
        await self._redis.setex(
            key,
            ttl or self._default_ttl,
            json.dumps(value, default=str),
        )

    async def delete(self, key: str) -> None:
        """Delete from cache."""
        await self._redis.delete(key)

    async def delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching pattern."""
        keys = []
        async for key in self._redis.scan_iter(pattern):
            keys.append(key)
        if keys:
            await self._redis.delete(*keys)


# Dependency
async def get_cache() -> CacheService:
    redis = Redis.from_url(settings.REDIS_URL)
    try:
        yield CacheService(redis)
    finally:
        await redis.close()
```

### DON'T ❌

```python
# No TTL
await redis.set(key, value)  # Never expires!

# Cache without invalidation
await cache.set("products:all", products)  # Stale forever

# Cache everything
await cache.set(f"user:{id}:last_login", now)  # Pointless
```

---

## Celery Tasks

### DO ✅

```python
# celery_app.py
from celery import Celery

celery = Celery(
    "tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


# tasks/email.py
from app.celery_app import celery


@celery.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(ConnectionError, TimeoutError),
)
def send_email(self, to: str, subject: str, template: str, data: dict) -> None:
    """Send email task with retry."""
    try:
        email_service.send(to, subject, template, data)
    except Exception as exc:
        self.retry(exc=exc)


# Usage in service
class UserService:
    async def create(self, data: UserCreate) -> User:
        user = await self._repo.create(data)
        
        # Queue email (non-blocking)
        send_email.delay(
            to=user.email,
            subject="Welcome!",
            template="welcome",
            data={"name": user.name},
        )
        
        return user
```

### DON'T ❌

```python
# Blocking email in request
@router.post("/users")
async def create_user(data: UserCreate):
    user = await service.create(data)
    await send_email(user.email)  # User waits for email!
    return user

# No retry configuration
@celery.task
def important_task():  # One failure = lost forever
    ...
```

---

## Background Tasks (FastAPI)

### DO ✅

```python
from fastapi import BackgroundTasks


async def process_upload(file_id: str) -> None:
    """Background processing."""
    file = await file_service.get(file_id)
    await file_service.process(file)
    await notification_service.notify(file.user_id, "Processing complete")


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    background_tasks: BackgroundTasks,
) -> UploadResponse:
    # Save file
    saved = await file_service.save(file)
    
    # Process in background
    background_tasks.add_task(process_upload, saved.id)
    
    return UploadResponse(id=saved.id, status="processing")
```

---

## RabbitMQ with aio-pika

### DO ✅

```python
import aio_pika
from aio_pika import Message, ExchangeType


class MessageQueue:
    def __init__(self, connection: aio_pika.Connection) -> None:
        self._connection = connection
        self._channel: aio_pika.Channel | None = None

    async def connect(self) -> None:
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)

    async def publish(self, exchange: str, routing_key: str, body: dict) -> None:
        """Publish message."""
        exchange_obj = await self._channel.declare_exchange(
            exchange, ExchangeType.TOPIC, durable=True
        )
        message = Message(
            json.dumps(body).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await exchange_obj.publish(message, routing_key=routing_key)

    async def consume(
        self,
        queue: str,
        callback: Callable[[dict], Awaitable[None]],
    ) -> None:
        """Consume messages."""
        queue_obj = await self._channel.declare_queue(queue, durable=True)
        
        async for message in queue_obj:
            async with message.process():
                body = json.loads(message.body)
                await callback(body)
```

---

## Docker Configuration

### DO ✅

```dockerfile
# Dockerfile
FROM python:3.12-slim AS builder

WORKDIR /app

# Install dependencies
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction

# Production image
FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/app
      - REDIS_URL=redis://redis:6379
      - CELERY_BROKER_URL=amqp://rabbitmq:5672
    depends_on:
      - mongo
      - redis
      - rabbitmq
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  celery:
    build: .
    command: celery -A app.celery_app worker --loglevel=info
    environment:
      - CELERY_BROKER_URL=amqp://rabbitmq:5672
    depends_on:
      - rabbitmq

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "15672:15672"

volumes:
  mongo_data:
  redis_data:
```

---

## Health Checks

### DO ✅

```python
@router.get("/health")
async def health_check(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> dict:
    """Health check endpoint."""
    services = {}

    # Check MongoDB
    try:
        await db.command("ping")
        services["mongodb"] = "connected"
    except Exception:
        services["mongodb"] = "disconnected"

    # Check Redis
    try:
        await redis.ping()
        services["redis"] = "connected"
    except Exception:
        services["redis"] = "disconnected"

    is_healthy = all(s == "connected" for s in services.values())

    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "services": services,
    }


@router.get("/health/live")
async def liveness() -> dict:
    """Liveness probe."""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> dict:
    """Readiness probe."""
    try:
        await db.command("ping")
        return {"status": "ready"}
    except Exception:
        raise HTTPException(503, "Not ready")
```

---

## Configuration with Pydantic

### DO ✅

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # App
    APP_NAME: str = "API"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "app"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Celery
    CELERY_BROKER_URL: str = "amqp://localhost:5672"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Auth
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str


settings = Settings()
```

---

## Quick Reference

| Technology | Use Case |
|------------|----------|
| Redis | Caching, sessions, pub/sub |
| Celery | Background tasks, scheduling |
| RabbitMQ | Message queuing |
| Docker | Containerization |

| Cache Pattern | When to Use |
|---------------|-------------|
| Cache-aside | General caching |
| TTL | Time-based expiry |
| Invalidation | On data change |

| Task Type | Use |
|-----------|-----|
| BackgroundTasks | Simple, same process |
| Celery | Complex, distributed, retries |
