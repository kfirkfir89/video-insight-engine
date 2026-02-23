# FastAPI Patterns

App setup, routing, dependencies, and middleware patterns.

---

## App Bootstrap

### DO ✅

```python
# main.py
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import setup_exception_handlers
from app.core.database import connect_db, close_db
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown events."""
    await connect_db()
    yield
    await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    setup_exception_handlers(app)

    # Routes
    app.include_router(users_router, prefix="/api/v1/users", tags=["users"])

    return app


app = create_app()
```

### DON'T ❌

```python
# Everything in one file, no factory
app = FastAPI()

@app.get("/users")
async def get_users():
    db = connect()  # Connection per request!
    return db.query(...)
```

---

## Route Organization

### DO ✅

```python
# users/router.py
from fastapi import APIRouter, Depends, status
from typing import Annotated

from app.users.schemas import UserCreate, UserResponse, UserList
from app.users.service import UserService
from app.users.dependencies import get_user_service
from app.core.dependencies import get_current_user

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    """Create a new user."""
    return await service.create(data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    """Get user by ID."""
    return await service.find_by_id(user_id)
```

### DON'T ❌

```python
# All routes in main.py
@app.get("/api/v1/users")
async def list_users(): ...

@app.get("/api/v1/orders")
async def list_orders(): ...

# 500 more routes...
```

---

## JSON Response Performance

Pydantic v2 uses Rust-based serialization internally. When you return a Pydantic model and declare `response_model`, FastAPI skips `jsonable_encoder` entirely and serializes directly via Pydantic's Rust layer — matching `orjson` performance out of the box.

### DO ✅

```python
# Return Pydantic models with response_model — Rust-fast by default
@router.post("/summarize", response_model=SummarizeResponse, status_code=202)
async def summarize(data: SummarizeRequest) -> SummarizeResponse:
    result = await service.summarize(data)
    return result
```

### DON'T ❌

```python
# ORJSONResponse / UJSONResponse — unnecessary with Pydantic v2
from fastapi.responses import ORJSONResponse

@router.post("/summarize", response_class=ORJSONResponse)
async def summarize(data: dict):
    return ORJSONResponse(content=result.model_dump())

# Returning raw dicts bypasses Pydantic validation and serialization
@router.get("/items")
async def list_items():
    return {"items": [item.__dict__ for item in items]}
```

**Why:** FastAPI 0.115+ with Pydantic 2.5+ eliminates the need for third-party JSON response classes. Declare `response_model` and return the Pydantic model directly.

---

## Dependency Injection

### DO ✅

```python
# dependencies.py
from typing import Annotated
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.users.repository import UserRepository
from app.users.service import UserService


async def get_user_repository(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> UserRepository:
    return UserRepository(db)


async def get_user_service(
    repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> UserService:
    return UserService(repo)
```

### DON'T ❌

```python
# Global instances
user_repo = UserRepository()
user_service = UserService(user_repo)

@router.get("/{id}")
async def get_user(id: str):
    return await user_service.find_by_id(id)  # Can't mock!
```

---

## Request Validation

### DO ✅

```python
# schemas.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserCreate(BaseModel):
    """Input for creating a user."""
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """Input for updating a user (all optional)."""
    name: str | None = Field(None, min_length=2, max_length=100)


class UserResponse(BaseModel):
    """Output for user data."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    created_at: datetime


# Route automatically validates
@router.post("", response_model=UserResponse)
async def create_user(data: UserCreate) -> UserResponse:
    # data is guaranteed valid here
    return await service.create(data)
```

### DON'T ❌

```python
# Manual validation in route
@router.post("")
async def create_user(data: dict):
    if "email" not in data:
        raise HTTPException(400, "Email required")
    if "@" not in data["email"]:
        raise HTTPException(400, "Invalid email")
    # More validation...
```

---

## Path & Query Parameters

### DO ✅

```python
from typing import Annotated
from fastapi import Path, Query


@router.get("/{user_id}")
async def get_user(
    user_id: Annotated[str, Path(description="User ID", min_length=24, max_length=24)],
) -> UserResponse:
    return await service.find_by_id(user_id)


@router.get("")
async def list_users(
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> UserList:
    return await service.find_all(skip=skip, limit=limit, search=search)
```

---

## Middleware

### DO ✅

```python
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Process-Time"] = str(duration)
        return response


# Add to app
app.add_middleware(TimingMiddleware)
```

---

## Background Tasks

### DO ✅

```python
from fastapi import BackgroundTasks


async def send_welcome_email(email: str, name: str) -> None:
    # Async email sending
    await email_service.send_welcome(email, name)


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    background_tasks: BackgroundTasks,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    user = await service.create(data)
    
    # Run after response is sent
    background_tasks.add_task(send_welcome_email, user.email, user.name)
    
    return user
```

---

## Graceful Shutdown

### DO ✅

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    await connect_db()
    await connect_redis()
    logger.info("Application started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await close_redis()
    await close_db()
    logger.info("Shutdown complete")
```

---

## Quick Reference

| Pattern | When to Use |
|---------|-------------|
| `Depends()` | Inject dependencies into routes |
| `BackgroundTasks` | Fire-and-forget after response |
| `lifespan` | Startup/shutdown logic |
| `APIRouter` | Group related routes |
| Pydantic models | Validate all input/output |

| Annotation | Purpose |
|------------|---------|
| `Path()` | Validate path parameters |
| `Query()` | Validate query parameters |
| `Body()` | Validate request body |
| `Annotated` | Attach metadata to types |
