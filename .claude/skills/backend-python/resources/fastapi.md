# FastAPI Patterns

App setup, routing, dependencies, and middleware for FastAPI.

<rules>
- ALWAYS use the app factory pattern with `create_app()` and `lifespan` context manager (monolithic app files become unmaintainable past 5 routes)
- ALWAYS use `APIRouter` to group routes by feature, mounted with prefix and tags (routes in main.py creates a god module)
- ALWAYS use `Annotated[T, Depends()]` for dependency injection (hidden dependencies cannot be mocked in tests)
- ALWAYS declare `response_model` on routes — Pydantic v2 serializes via Rust, matching orjson speed (returning raw dicts bypasses validation and documentation)
- NEVER put all routes in main.py (creates merge conflicts and makes features impossible to delete cleanly)
- NEVER use `ORJSONResponse` or `UJSONResponse` with Pydantic v2 (unnecessary — native serialization is already Rust-fast)
- NEVER do manual validation in route handlers when Pydantic schemas exist (duplicates logic and misses edge cases)
</rules>

---

## App Bootstrap

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await connect_db()
    yield
    await close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        docs_url="/docs" if settings.DEBUG else None,
        lifespan=lifespan,
    )
    setup_exception_handlers(app)
    app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
    return app
```

---

## Route Organization

Routes parse requests, call services, and format responses. No business logic, no database access.

```python
router = APIRouter()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    return await service.create(data)
```

---

## Dependency Injection

Chain dependencies: database -> repository -> service. Each layer receives its dependencies via `Depends()`.

```python
async def get_user_repository(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> UserRepository:
    return UserRepository(db)

async def get_user_service(
    repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> UserService:
    return UserService(repo)
```

---

## Request Validation

Use Pydantic schemas with Field constraints. Separate Create (required fields) from Update (optional fields) schemas.

```python
class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
```

Use `Annotated[str, Path()]` and `Annotated[int, Query(ge=0)]` for path/query parameter validation.

---

## Background Tasks & Middleware

Use `BackgroundTasks` for fire-and-forget work after response. Use `BaseHTTPMiddleware` for cross-cutting concerns (timing, request IDs). Use `lifespan` for startup/shutdown — never `@app.on_event`.

---

## Edge Cases

- **Circular imports between feature modules**: Use `dependencies.py` per feature to break import cycles. Routes import from dependencies, not directly from other features.
- **Lifespan vs on_event**: `lifespan` is the only supported pattern in FastAPI 0.115+. `@app.on_event("startup")` is deprecated.
- **Response model with Optional fields**: Use `response_model_exclude_none=True` on the route to omit None fields from JSON output.

---

## Rules Summary

Use app factory with lifespan for startup/shutdown. Group routes in APIRouter by feature. Inject all dependencies via `Annotated[T, Depends()]`. Validate every input with Pydantic schemas and Field constraints. Declare `response_model` on every route for automatic Rust-speed serialization. Keep route handlers thin — delegate to services immediately. Use BackgroundTasks for post-response work, BaseHTTPMiddleware for cross-cutting concerns.
