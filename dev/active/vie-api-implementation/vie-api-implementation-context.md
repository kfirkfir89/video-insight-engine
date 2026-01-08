# Context: vie-api Implementation

> **Last Updated:** 2026-01-08

---

## Key Files to Modify/Create

### New Files (api/)
| File | Purpose |
|------|---------|
| `api/package.json` | Dependencies and scripts |
| `api/tsconfig.json` | TypeScript configuration |
| `api/Dockerfile` | Container build |
| `api/src/index.ts` | Entry point |
| `api/src/config.ts` | Environment validation |
| `api/src/plugins/*.ts` | Fastify plugins (5 files) |
| `api/src/routes/*.ts` | HTTP routes (5 files) |
| `api/src/services/*.ts` | Business logic (3 files) |
| `api/src/schemas/*.ts` | Zod schemas (2 files) |
| `api/src/utils/*.ts` | Utilities (2 files) |

### Existing Files to Modify
| File | Change |
|------|--------|
| `docker-compose.yml` | Uncomment vie-api service |

---

## Reference Documentation

### Primary
- **Implementation Guide:** `docs/Implementation /IMPL-01-API.md` - Step-by-step code
- **Data Models:** `docs/DATA-MODELS.md` - MongoDB schemas
- **REST API Spec:** `docs/API-REST.md` - Endpoint contracts

### Supporting
- **Security:** `docs/SECURITY.md` - JWT, rate limiting, CORS
- **Error Handling:** `docs/ERROR-HANDLING.md` - Error codes, formats
- **Architecture:** `docs/ARCHITECTURE.md` - System overview

### Skills
- **Backend Principles:** `.claude/skills/backend-node/SKILL.md`

---

## Key Decisions

### 1. Type-based vs Feature-based Structure
**Decision:** Type-based (routes/, services/, schemas/)
**Reason:** Small service with limited features; follows IMPL-01 structure

### 2. ORM vs Native Driver
**Decision:** Native MongoDB driver
**Reason:** No need for ORM complexity; direct control over queries

### 3. Error Handling Strategy
**Decision:** Domain errors in services, HTTP conversion in routes
**Reason:** Services don't know HTTP; routes handle status codes

### 4. Authentication
**Decision:** JWT access tokens (memory) + refresh tokens (HttpOnly cookie)
**Reason:** Security best practice; prevents XSS token theft

### 5. Summarizer Integration
**Decision:** Fire-and-forget HTTP POST
**Reason:** No message queue (MVP simplicity); non-blocking

---

## Shared Types Reference

From `packages/types/src/index.ts`:

```typescript
// Status Types
ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'
FolderType = 'summarized' | 'memorized'
SourceType = 'video_section' | 'video_concept' | 'system_expansion'
TargetType = 'section' | 'concept'

// Response Types
AuthResponse { accessToken, expiresIn, user }
VideoResponse { id, videoSummaryId, youtubeId, title, ... }
FolderResponse { id, name, type, parentId, path, ... }

// WebSocket Events
VideoStatusEvent { type: 'video.status', payload: {...} }
ExpansionStatusEvent { type: 'expansion.status', payload: {...} }

// Error Types
ApiError { error, message, statusCode }
ErrorCodes { INVALID_CREDENTIALS, EMAIL_EXISTS, ... }
```

---

## MongoDB Collections Used

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User accounts | email, passwordHash, name |
| `userVideos` | User's video library | userId, videoSummaryId, status |
| `videoSummaryCache` | Shared cache | youtubeId, status, summary |
| `folders` | User folders | userId, name, type, path |
| `memorizedItems` | Saved content | userId, sourceType, content |

---

## Environment Variables

```bash
# Required
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/vie
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>

# Optional
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
SUMMARIZER_URL=http://vie-summarizer:8000
```

---

## API Endpoints Summary

### Auth
```
POST /api/auth/register    → { accessToken, user }
POST /api/auth/login       → { accessToken, user }
POST /api/auth/refresh     → { accessToken }
POST /api/auth/logout      → { success: true }
GET  /api/auth/me          → { id, email, name }
```

### Videos
```
GET    /api/videos         → { videos: [...] }
GET    /api/videos/:id     → { video, summary }
POST   /api/videos         → { video, cached }
DELETE /api/videos/:id     → 204 No Content
```

### Stubs (MVP)
```
GET    /api/folders        → { folders: [] }
POST   /api/folders        → { id: 'stub' }
GET    /api/memorize       → { items: [] }
POST   /api/memorize       → { id: 'stub' }
GET    /api/explain/:id    → { expansion: '...' }
POST   /api/explain/chat   → { response, chatId }
```

---

## Testing Commands

```bash
# Health check
curl http://localhost:3000/health

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","name":"Test"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'

# Submit video (with token)
curl -X POST http://localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

---

## Common Patterns

### Plugin Pattern
```typescript
import fp from 'fastify-plugin';

async function myPlugin(fastify: FastifyInstance) {
  // Plugin logic
  fastify.decorate('myThing', value);
}

export const myPlugin = fp(myPlugin);
```

### Route Pattern
```typescript
export async function myRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const result = await service.doThing(req.user.id);
    return result;
  });
}
```

### Service Pattern
```typescript
export class MyService {
  constructor(private db: Db) {}

  async doThing(userId: string) {
    // Business logic
    const result = await this.db.collection('things').find({ userId }).toArray();
    return result.map(formatThing);
  }
}
```

---

## Gotchas & Warnings

1. **fastify-plugin wrapper** - All plugins MUST use `fp()` or decorators won't propagate
2. **ESM imports** - Use `.js` extension in imports (`import { config } from './config.js'`)
3. **Async plugin registration** - Use `await fastify.register()`
4. **JWT payload** - Access via `req.user` after `jwtVerify()`
5. **Cookie path** - Refresh token cookie must have `path: '/api/auth/refresh'`
6. **Rate limit scope** - Use user ID for authenticated, IP for public routes
