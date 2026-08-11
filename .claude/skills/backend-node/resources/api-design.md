# API Design Patterns

REST conventions, response format, versioning, pagination, and OpenAPI.

<rules>
- ALWAYS use plural nouns for resource URLs (`/users`, not `/user`) with lowercase and hyphens (causes inconsistent API surface if mixed)
- ALWAYS return consistent envelope: `{ success: true, data, meta? }` for success, `{ success: false, error: { code, message } }` for errors (causes client parsing nightmares if format varies)
- ALWAYS use correct HTTP status codes: 201 for POST create, 204 for DELETE, 400 for validation, 404 for not found (causes misleading responses if always returning 200)
- ALWAYS version APIs via URL prefix `/api/v1/` (causes breaking changes affecting all clients if unversioned)
- ALWAYS use cursor-based pagination for large datasets (causes O(n) performance if using skip/offset at scale)
- NEVER put verbs in URLs — use HTTP methods instead (causes RESTless API design)
- NEVER return arrays at root level — always wrap in envelope (causes inability to extend response with metadata)
</rules>

---

## URL Structure

```
GET    /api/v1/users          # List
GET    /api/v1/users/:id      # Get one
POST   /api/v1/users          # Create → 201
PATCH  /api/v1/users/:id      # Partial update
DELETE /api/v1/users/:id      # Delete → 204
POST   /api/v1/users/:id/activate  # Action (when CRUD doesn't fit)
GET    /api/v1/users?status=active&sort=-createdAt&page=2&limit=20
```

---

## Response Format

```typescript
// Success (single)
{ "success": true, "data": { "id": "123", "email": "user@example.com" } }

// Success (collection)
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 150 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid email", "details": [...] } }
```

---

## Status Codes

| Code | When                      |
| ---- | ------------------------- |
| 200  | GET/PATCH/PUT success     |
| 201  | POST created              |
| 204  | DELETE success            |
| 400  | Validation error          |
| 401  | Missing/invalid auth      |
| 403  | Valid auth, no permission |
| 404  | Not found                 |
| 409  | Conflict/duplicate        |
| 422  | Business rule violated    |
| 429  | Rate limited              |
| 500  | Internal error            |

---

## Pagination

Cursor-based for large datasets, offset-based for small:

```typescript
// Cursor-based: GET /api/v1/posts?cursor=abc123&limit=20
{ "data": [...], "meta": { "nextCursor": "def456", "hasMore": true } }

// Offset-based: GET /api/v1/users?page=2&limit=20
{ "data": [...], "meta": { "page": 2, "limit": 20, "total": 150, "totalPages": 8 } }
```

---

## Sorting & Filtering

```
GET /api/v1/users?sort=-createdAt,name  # - prefix = descending
GET /api/v1/users?status=active&role=admin&createdAfter=2024-01-01
```

Parse sort strings into MongoDB-compatible objects:

```typescript
function parseSort(sort?: string): Record<string, 1 | -1> {
  if (!sort) return { createdAt: -1 };
  return sort.split(",").reduce(
    (acc, field) => {
      acc[field.startsWith("-") ? field.slice(1) : field] = field.startsWith(
        "-",
      )
        ? -1
        : 1;
      return acc;
    },
    {} as Record<string, 1 | -1>,
  );
}
```

---

## Versioning & Deprecation

```typescript
app.register(v1Routes, { prefix: "/api/v1" });
app.register(v2Routes, { prefix: "/api/v2" });

// Deprecation headers on v1
reply.header("Deprecation", "true");
reply.header("Sunset", "Sat, 31 Dec 2024 23:59:59 GMT");
reply.header("Link", '</api/v2/users>; rel="successor-version"');
```

---

## Edge Cases

- **Empty collections**: Return `{ data: [], meta: { total: 0 } }` — never 404 for empty lists. 404 is for missing individual resources.
- **Partial updates with null**: PATCH with `{ name: null }` should clear the field. Document whether null means "unset" or "skip".
- **IDs as strings**: Always use string IDs in responses (future-proof for UUID migration from ObjectId).

---

## Rules Summary

URLs use plural nouns with hyphens, versioned under `/api/v1/`. HTTP methods map to operations: GET reads, POST creates (201), PATCH updates, DELETE removes (204). All responses use a consistent `{ success, data/error, meta? }` envelope. Pagination defaults to cursor-based for performance; offset-based is acceptable for small datasets. Sorting uses `-field` for descending. Filtering uses query parameters. API versions include deprecation headers when sunsetting. IDs are always strings. Dates are ISO 8601.
