# API Design Patterns

REST conventions, versioning, error responses, and OpenAPI documentation.

<rules>
- ALWAYS use plural nouns for resource URLs — `/api/v1/users`, not `/api/v1/user` (inconsistent pluralization confuses API consumers and breaks conventions)
- ALWAYS return consistent response format: `{success, data, meta?}` for success, `{success, error: {code, message}}` for errors (inconsistent formats force clients to handle every endpoint differently)
- ALWAYS use correct HTTP status codes: 201 for created, 204 for deleted, 404 for not found (200-for-everything hides errors from monitoring and client error handling)
- ALWAYS version APIs via URL prefix `/api/v1/` (unversioned APIs cannot evolve without breaking existing clients)
- NEVER use verbs in URLs — `POST /users` not `POST /createUser` (verbs in URLs duplicate the HTTP method semantics)
- NEVER return arrays at the root level — always wrap in `{data: [...]}` (root arrays cannot be extended with metadata without breaking clients)
</rules>

---

## URL Structure

```
GET    /api/v1/users              # List
GET    /api/v1/users/{id}         # Get one
POST   /api/v1/users              # Create
PATCH  /api/v1/users/{id}         # Partial update
DELETE /api/v1/users/{id}         # Delete
POST   /api/v1/users/{id}/activate  # Actions as sub-resources
GET    /api/v1/users?status=active&sort=-created_at&page=2&limit=20
```

---

## Response Format

```python
class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T
    meta: PaginationMeta | None = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail  # {code, message, details?, request_id?}
```

---

## Status Codes

| Code | When |
|------|------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 422 | Business rule violation |
| 429 | Rate limited |

---

## Pagination

Use cursor-based pagination for large datasets (efficient), offset-based for small datasets (simple).

```python
class CursorPaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: list[T]
    next_cursor: str | None
    has_more: bool
```

Sorting: `-field` for descending, `field` for ascending. Parse with a `parse_sort()` helper.

---

## Versioning & OpenAPI

Mount versioned routers: `app.include_router(v1_router, prefix="/api/v1")`. Add deprecation headers (`Deprecation`, `Sunset`, `Link`) on old versions. Document routes with `responses={}` for error models and `summary`/`description` for Swagger.

---

## Edge Cases

- **Nested resources depth**: Limit to one level of nesting (`/users/{id}/posts`). Deeper nesting (`/users/{id}/posts/{pid}/comments`) should be flattened to `/comments?post_id={pid}`.
- **DELETE idempotency**: DELETE should return 204 whether the resource existed or not. Never return 404 on DELETE — it is idempotent by definition.
- **PATCH vs PUT**: PATCH sends only changed fields (use `exclude_unset=True`). PUT replaces the entire resource. Prefer PATCH for most update operations.

---

## Rules Summary

Use plural nouns in URLs, correct HTTP methods and status codes, and consistent response formats. Version via URL prefix. Wrap collections in `{data: [...]}` with pagination metadata. Use cursor pagination for large datasets. Document every route with response models for OpenAPI. Add deprecation headers when sunsetting old versions. Keep nesting shallow — one level max.
