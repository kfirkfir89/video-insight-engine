# API Design Patterns

REST conventions, versioning, error responses, and OpenAPI.

---

## URL Structure

### DO ✅

```
# Resources are nouns (plural)
GET    /api/v1/users          # List users
GET    /api/v1/users/:id      # Get user
POST   /api/v1/users          # Create user
PATCH  /api/v1/users/:id      # Update user
DELETE /api/v1/users/:id      # Delete user

# Nested resources
GET    /api/v1/users/:id/posts         # User's posts
POST   /api/v1/users/:id/posts         # Create post for user

# Actions as sub-resources (when CRUD doesn't fit)
POST   /api/v1/users/:id/activate      # Activate user
POST   /api/v1/orders/:id/cancel       # Cancel order

# Filtering, sorting, pagination via query params
GET    /api/v1/users?status=active&sort=-createdAt&page=2&limit=20
```

### DON'T ❌

```
# Verbs in URLs
GET    /api/getUsers
POST   /api/createUser
POST   /api/deleteUser/:id

# Singular resources
GET    /api/user/:id

# Inconsistent nesting
GET    /api/users/:id/post/:postId  # Should be /posts/:postId
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

```typescript
// GET - Read (no side effects)
app.get('/users/:id', getUser);

// POST - Create (returns 201 + Location header)
app.post('/users', createUser);

// PATCH - Partial update (only send changed fields)
app.patch('/users/:id', updateUser);

// PUT - Full replace (send entire resource)
app.put('/users/:id', replaceUser);

// DELETE - Remove (returns 204 No Content)
app.delete('/users/:id', deleteUser);
```

---

## Response Format

### DO ✅

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Single resource
{
  "success": true,
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}

// Collection
{
  "success": true,
  "data": [
    { "id": "1", "name": "User 1" },
    { "id": "2", "name": "User 2" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### DON'T ❌

```typescript
// Inconsistent formats
{ "user": { ... } }        // One endpoint
{ "data": { ... } }        // Another endpoint
{ "result": [ ... ] }      // Yet another

// Array at root (can't extend)
[{ "id": 1 }, { "id": 2 }]
```

---

## Error Responses

### DO ✅

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable
    message: string;        // Human-readable
    details?: unknown;      // Additional info
    requestId?: string;     // For support
  };
}

// 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "age", "message": "Must be at least 18" }
    ]
  }
}

// 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}

// 404 Not Found
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "requestId": "req_abc123"
  }
}

// 500 Internal Error (never expose details!)
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_abc123"
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

```typescript
// 200 for everything
return reply.status(200).send({ error: 'Not found' });

// Wrong codes
return reply.status(400).send({ error: 'Not found' }); // Should be 404
return reply.status(500).send({ error: 'Invalid email' }); // Should be 400
```

---

## Versioning

### DO ✅

```typescript
// URL versioning (recommended)
app.register(v1Routes, { prefix: '/api/v1' });
app.register(v2Routes, { prefix: '/api/v2' });

// Version in URL
GET /api/v1/users
GET /api/v2/users  // New format

// Deprecation headers
reply.header('Deprecation', 'true');
reply.header('Sunset', 'Sat, 31 Dec 2024 23:59:59 GMT');
reply.header('Link', '</api/v2/users>; rel="successor-version"');
```

### DON'T ❌

```typescript
// No versioning
GET /api/users  // Breaking changes affect everyone

// Query param versioning (harder to cache)
GET /api/users?version=2
```

---

## Pagination

### DO ✅

```typescript
// Cursor-based (recommended for large datasets)
interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

interface CursorPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// GET /api/v1/posts?cursor=eyJpZCI6MTIzfQ&limit=20

// Offset-based (simpler, for small datasets)
interface OffsetPaginationParams {
  page?: number;
  limit?: number;
}

interface OffsetPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET /api/v1/users?page=2&limit=20
```

---

## Filtering & Sorting

### DO ✅

```typescript
// Query params for filtering
GET /api/v1/users?status=active&role=admin&createdAfter=2024-01-01

// Sorting with prefix
GET /api/v1/users?sort=-createdAt        // Descending
GET /api/v1/users?sort=name              // Ascending
GET /api/v1/users?sort=-createdAt,name   // Multiple fields

// Implementation
interface QueryParams {
  status?: string;
  role?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

function parseSort(sort?: string): Record<string, 1 | -1> {
  if (!sort) return { createdAt: -1 };
  
  return sort.split(',').reduce((acc, field) => {
    if (field.startsWith('-')) {
      acc[field.slice(1)] = -1;
    } else {
      acc[field] = 1;
    }
    return acc;
  }, {} as Record<string, 1 | -1>);
}
```

---

## OpenAPI / Swagger

### DO ✅

```typescript
// With @fastify/swagger
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

await app.register(swagger, {
  openapi: {
    info: {
      title: 'API Documentation',
      version: '1.0.0',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://api.example.com', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
});

// Schema in routes
app.get('/users/:id', {
  schema: {
    tags: ['Users'],
    summary: 'Get user by ID',
    params: userParamsSchema,
    response: {
      200: userResponseSchema,
      404: errorResponseSchema,
    },
    security: [{ bearerAuth: [] }],
  },
  handler: getUser,
});
```

---

## HATEOAS Links

### DO ✅

```typescript
// Include related links
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "_links": {
      "self": { "href": "/api/v1/users/123" },
      "posts": { "href": "/api/v1/users/123/posts" },
      "avatar": { "href": "/api/v1/users/123/avatar" }
    }
  }
}

// Pagination links
{
  "success": true,
  "data": [...],
  "meta": { "page": 2, "totalPages": 5 },
  "_links": {
    "self": { "href": "/api/v1/users?page=2" },
    "first": { "href": "/api/v1/users?page=1" },
    "prev": { "href": "/api/v1/users?page=1" },
    "next": { "href": "/api/v1/users?page=3" },
    "last": { "href": "/api/v1/users?page=5" }
  }
}
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
