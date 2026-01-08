# API Design Patterns

REST conventions, versioning, error responses, and OpenAPI.

---

## URL Structure

### DO ✅

```
# Resources are nouns (plural)
GET    /api/v1/users          # List users
GET    /api/v1/users/{id}     # Get user
POST   /api/v1/users          # Create user
PATCH  /api/v1/users/{id}     # Update user
DELETE /api/v1/users/{id}     # Delete user

# Nested resources
GET    /api/v1/users/{id}/posts         # User's posts
POST   /api/v1/users/{id}/posts         # Create post for user

# Actions as sub-resources (when CRUD doesn't fit)
POST   /api/v1/users/{id}/activate      # Activate user
POST   /api/v1/orders/{id}/cancel       # Cancel order

# Filtering, sorting, pagination via query params
GET    /api/v1/users?status=active&sort=-created_at&page=2&limit=20
```

### DON'T ❌

```
# Verbs in URLs
GET    /api/getUsers
POST   /api/createUser
POST   /api/deleteUser/{id}

# Singular resources
GET    /api/user/{id}

# Inconsistent nesting
GET    /api/users/{id}/post/{post_id}  # Should be /posts/{post_id}
```

---

## HTTP Methods

### DO ✅

| Method | Purpose | Idempotent | Request Body |
|--------|---------|------------|--------------|
| GET | Read resource | Yes | No |
| POST | Create resource | No | Yes |
| PUT | Replace resource | Yes | Yes |
| PATCH | Partial update | Yes | Yes |
| DELETE | Remove resource | Yes | No |

```python
from fastapi import APIRouter, status

router = APIRouter(prefix="/api/v1/users", tags=["users"])

# GET - Read (no side effects)
@router.get("/{user_id}")
async def get_user(user_id: str) -> UserResponse: ...

# POST - Create (returns 201 + Location header)
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate) -> UserResponse: ...

# PATCH - Partial update
@router.patch("/{user_id}")
async def update_user(user_id: str, data: UserUpdate) -> UserResponse: ...

# DELETE - Remove (returns 204 No Content)
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str) -> None: ...
```

---

## Response Format

### DO ✅

```python
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T
    meta: PaginationMeta | None = None


# Single resource
{
    "success": true,
    "data": {
        "id": "123",
        "email": "user@example.com",
        "name": "John Doe",
        "created_at": "2024-01-15T10:30:00Z"
    }
}

# Collection
{
    "success": true,
    "data": [
        {"id": "1", "name": "User 1"},
        {"id": "2", "name": "User 2"}
    ],
    "meta": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "total_pages": 8
    }
}
```

### DON'T ❌

```python
# Inconsistent formats
{"user": {...}}        # One endpoint
{"data": {...}}        # Another endpoint
{"result": [...]}      # Yet another

# Array at root (can't extend)
[{"id": 1}, {"id": 2}]
```

---

## Error Responses

### DO ✅

```python
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str           # Machine-readable
    message: str        # Human-readable
    details: list[dict] | None = None
    request_id: str | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


# 400 Bad Request
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request data",
        "details": [
            {"field": "email", "message": "Invalid email format"},
            {"field": "age", "message": "Must be at least 18"}
        ]
    }
}

# 404 Not Found
{
    "success": false,
    "error": {
        "code": "NOT_FOUND",
        "message": "User not found",
        "request_id": "req_abc123"
    }
}

# 500 Internal Error (never expose details!)
{
    "success": false,
    "error": {
        "code": "INTERNAL_ERROR",
        "message": "An unexpected error occurred",
        "request_id": "req_abc123"
    }
}
```

---

## Status Codes

### DO ✅

| Code | When to Use |
|------|-------------|
| 200 | Success (GET, PATCH, PUT) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (no/invalid auth) |
| 403 | Forbidden (auth ok, no permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate, constraint) |
| 422 | Unprocessable (business rule) |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### DON'T ❌

```python
# 200 for everything
return JSONResponse(status_code=200, content={"error": "Not found"})

# Wrong codes
raise HTTPException(status_code=400, detail="Not found")  # Should be 404
raise HTTPException(status_code=500, detail="Invalid email")  # Should be 400
```

---

## Versioning

### DO ✅

```python
from fastapi import FastAPI, APIRouter

app = FastAPI()

# Version via URL prefix
v1_router = APIRouter(prefix="/api/v1")
v2_router = APIRouter(prefix="/api/v2")

app.include_router(v1_router)
app.include_router(v2_router)


# Deprecation headers
from fastapi import Response

@v1_router.get("/users", deprecated=True)
async def list_users_v1(response: Response):
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Sat, 31 Dec 2024 23:59:59 GMT"
    response.headers["Link"] = '</api/v2/users>; rel="successor-version"'
    return await list_users()
```

---

## Pagination

### DO ✅

```python
from pydantic import BaseModel, Field
from typing import Generic, TypeVar

T = TypeVar("T")


# Cursor-based (recommended for large datasets)
class CursorParams(BaseModel):
    cursor: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class CursorPaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: list[T]
    next_cursor: str | None
    has_more: bool


# Offset-based (simpler, for small datasets)
class OffsetParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


class OffsetPaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: list[T]
    meta: PaginationMeta


# Usage
@router.get("")
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> OffsetPaginatedResponse[UserResponse]:
    users, total = await service.find_all(page=page, limit=limit)
    return OffsetPaginatedResponse(
        data=users,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=(total + limit - 1) // limit,
        ),
    )
```

---

## Filtering & Sorting

### DO ✅

```python
from fastapi import Query
from typing import Annotated


@router.get("")
async def list_users(
    status: Annotated[str | None, Query()] = None,
    role: Annotated[str | None, Query()] = None,
    sort: Annotated[str, Query()] = "-created_at",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[UserResponse]:
    """
    List users with filtering and sorting.
    
    - sort: Field to sort by. Prefix with `-` for descending.
    """
    sort_field, sort_order = parse_sort(sort)
    
    return await service.find_all(
        filters={"status": status, "role": role},
        sort_field=sort_field,
        sort_order=sort_order,
        page=page,
        limit=limit,
    )


def parse_sort(sort: str) -> tuple[str, int]:
    """Parse sort parameter."""
    if sort.startswith("-"):
        return sort[1:], -1  # Descending
    return sort, 1  # Ascending
```

---

## OpenAPI / Swagger

### DO ✅

```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="API Documentation",
    version="1.0.0",
    description="API for managing users and resources",
    docs_url="/docs",
    redoc_url="/redoc",
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Add security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# Document routes with responses
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    responses={
        404: {"model": ErrorResponse, "description": "User not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
    summary="Get user by ID",
    description="Retrieve a single user by their unique identifier.",
)
async def get_user(user_id: str) -> UserResponse:
    ...
```

---

## Quick Reference

| Aspect | Convention |
|--------|------------|
| URLs | Lowercase, hyphens, plural nouns |
| Methods | GET=read, POST=create, PATCH=update, DELETE=remove |
| Versioning | URL prefix `/api/v1/` |
| Pagination | Cursor-based or offset-based |
| Sorting | `-field` descending, `field` ascending |
| Dates | ISO 8601 (`2024-01-15T10:30:00Z`) |
| IDs | Strings (future-proof) |

| Status | Meaning |
|--------|---------|
| 2xx | Success |
| 4xx | Client error (fix your request) |
| 5xx | Server error (our fault) |
