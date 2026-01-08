# Implementation Plan: vie-api (Node.js Backend)

> **Last Updated:** 2026-01-08

---

## Executive Summary

Implement the vie-api service - the main REST API gateway for Video Insight Engine. This Node.js/Fastify/TypeScript backend handles authentication, video management, folder organization, and real-time updates via WebSocket. It serves as the central hub connecting the React frontend to MongoDB and Python backend services.

**Scope:** Complete implementation of IMPL-01-API.md (7 phases)
**Effort:** L (Large) - Estimated 15-20 implementation tasks
**Dependencies:** Phase 0 shared infrastructure (complete), MongoDB running

---

## Current State Analysis

### What Exists
| Component | Status | Notes |
|-----------|--------|-------|
| `api/` directory | Empty | Only .gitkeep present |
| `packages/types/` | Complete | All shared types defined |
| `packages/utils/` | Empty | Needs YouTube utils (can add later) |
| Docker config | Ready | vie-api service configured but commented out |
| MongoDB | Running | Health checks configured |
| Documentation | Complete | All specs, schemas, and guides available |

### What Needs Building
1. **Project scaffolding** - package.json, tsconfig.json, directory structure
2. **Core infrastructure** - Config, entry point, Fastify plugins
3. **Authentication system** - JWT, refresh tokens, user management
4. **Video management** - CRUD, caching, summarizer integration
5. **Folder system** - Organization hierarchy (stub for MVP)
6. **Memorize feature** - Knowledge collection (stub for MVP)
7. **Real-time updates** - WebSocket for processing status
8. **Containerization** - Dockerfile for deployment

---

## Proposed Architecture

```
api/
├── package.json
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts              # Entry point
    ├── config.ts             # Environment config (Zod validated)
    │
    ├── plugins/              # Fastify plugins
    │   ├── mongodb.ts        # Database connection
    │   ├── jwt.ts            # Authentication
    │   ├── cors.ts           # CORS configuration
    │   ├── rate-limit.ts     # Rate limiting
    │   └── websocket.ts      # Real-time updates
    │
    ├── routes/               # HTTP route handlers
    │   ├── auth.routes.ts
    │   ├── videos.routes.ts
    │   ├── folders.routes.ts
    │   ├── memorize.routes.ts
    │   └── explain.routes.ts
    │
    ├── services/             # Business logic
    │   ├── auth.service.ts
    │   ├── video.service.ts
    │   └── summarizer-client.ts  # HTTP client for vie-summarizer
    │
    ├── schemas/              # Zod validation schemas
    │   ├── auth.schema.ts
    │   └── video.schema.ts
    │
    └── utils/                # Utilities
        ├── errors.ts         # Custom error classes
        └── youtube.ts        # URL parsing
```

---

## Implementation Phases

### Phase 1: Project Setup
**Effort:** S | **Dependencies:** None

Create the foundational project structure with TypeScript configuration and dependencies.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 1.1 | Create `api/package.json` | All dependencies listed per IMPL-01, type: "module" |
| 1.2 | Create `api/tsconfig.json` | ES2022 target, NodeNext module resolution |
| 1.3 | Create directory structure | All folders from architecture diagram exist |
| 1.4 | Install dependencies | `pnpm install` succeeds in api/ |

---

### Phase 2: Core Infrastructure
**Effort:** M | **Dependencies:** Phase 1

Implement configuration, entry point, and all Fastify plugins.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 2.1 | Create `config.ts` | Zod schema validates all env vars, fails fast on missing |
| 2.2 | Create `index.ts` entry point | Fastify instance, plugin registration, health endpoint |
| 2.3 | Create MongoDB plugin | Connection with health check, graceful shutdown |
| 2.4 | Create JWT plugin | Access token verification, authenticate decorator |
| 2.5 | Create CORS plugin | Origins from config, credentials enabled |
| 2.6 | Create rate-limit plugin | Global 100/min, key generator for user/IP |

**Verification:** `pnpm dev` starts, `curl /health` returns `{"status":"ok"}`

---

### Phase 3: Authentication System
**Effort:** M | **Dependencies:** Phase 2

Complete auth flow with JWT access tokens and HttpOnly refresh cookies.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 3.1 | Create `auth.schema.ts` | Register/login schemas with password validation |
| 3.2 | Create `auth.service.ts` | Register, login, getUser methods with bcrypt |
| 3.3 | Create `auth.routes.ts` | All 5 endpoints: register, login, refresh, logout, me |
| 3.4 | Add rate limiting to auth | register: 5/hour, login: 10/15min |

**Verification:**
- Register returns accessToken + sets cookie
- Login returns accessToken + sets cookie
- Refresh returns new accessToken (cookie-based)
- Logout clears cookie
- `/me` returns user data (authenticated)

---

### Phase 4: Video Management
**Effort:** M | **Dependencies:** Phase 3

CRUD for user videos with cache-first pattern and summarizer integration.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 4.1 | Create `youtube.ts` utility | extractYoutubeId, isValidYoutubeUrl functions |
| 4.2 | Create `summarizer-client.ts` | Fire-and-forget HTTP call to vie-summarizer |
| 4.3 | Create `video.service.ts` | Cache check → create entry → trigger summarization |
| 4.4 | Create `videos.routes.ts` | GET /, GET /:id, POST /, DELETE /:id |
| 4.5 | Add rate limiting to videos | POST: 10/24hours per user |

**Verification:**
- POST /videos with YouTube URL creates entry with status "pending"
- GET /videos returns user's video list
- GET /videos/:id returns video with summary (if available)
- Duplicate URL returns cached result

---

### Phase 5: Stubs (Folders, Memorize, Explain)
**Effort:** S | **Dependencies:** Phase 3

Minimal stub routes for features to be fully implemented later.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 5.1 | Create `folders.routes.ts` stub | GET / returns [], POST / returns stub ID |
| 5.2 | Create `memorize.routes.ts` stub | GET / returns [], POST / returns stub ID |
| 5.3 | Create `explain.routes.ts` stub | GET returns placeholder, POST returns stub |

**Verification:** All stub endpoints respond with 200/201

---

### Phase 6: WebSocket
**Effort:** M | **Dependencies:** Phase 2

Real-time status updates for video processing.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 6.1 | Create `websocket.ts` plugin | Token auth, connection map, broadcast function |
| 6.2 | Add broadcast decorator | `fastify.broadcast(userId, event)` available |

**Verification:**
- WebSocket connects with valid token
- WebSocket rejects invalid/missing token
- Broadcast sends to correct user only

---

### Phase 7: Containerization
**Effort:** S | **Dependencies:** Phase 2

Docker image for deployment.

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 7.1 | Create `api/Dockerfile` | Multi-stage build, node:20-alpine |
| 7.2 | Uncomment vie-api in docker-compose | Service starts with `docker-compose up` |
| 7.3 | Test container build | `docker build -t vie-api api/` succeeds |

**Verification:**
- Container starts and responds to health check
- Container connects to MongoDB

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing fastify-plugin wrapper | High | Use `fp()` for all plugins to ensure proper encapsulation |
| JWT secret configuration | High | Validate with Zod, fail fast if missing |
| MongoDB connection issues | Medium | Health checks, graceful shutdown, connection retry |
| Rate limit bypass | Medium | Use user ID for authenticated routes, IP for public |
| WebSocket memory leaks | Medium | Cleanup on disconnect, use WeakMap if needed |

---

## Success Metrics

- [ ] All verification checklist items from IMPL-01 pass
- [ ] `pnpm dev` starts without errors
- [ ] Health check returns 200
- [ ] Register → Login → /me flow works
- [ ] Video submission creates pending entry
- [ ] WebSocket connects with valid token
- [ ] Docker container builds and runs
- [ ] TypeScript compiles with zero errors

---

## Dependencies

### External Dependencies (package.json)
```
fastify, @fastify/cors, @fastify/jwt, @fastify/cookie, @fastify/rate-limit,
@fastify/websocket, @fastify/helmet, fastify-plugin, mongodb, bcrypt, zod
```

### Dev Dependencies
```
typescript, tsx, @types/node, @types/bcrypt
```

### Internal Dependencies
- `@vie/types` - Shared TypeScript types (already complete)
- `vie-mongodb` - MongoDB service (running)
- `vie-summarizer` - Python summarizer (HTTP integration, may not be ready)

---

## Integration Points

| Service | Integration | Notes |
|---------|-------------|-------|
| vie-mongodb | MongoDB driver | Direct connection via MONGODB_URI |
| vie-summarizer | HTTP POST | Fire-and-forget, non-blocking |
| vie-explainer | MCP | Future integration (stub for now) |
| vie-web | REST + WebSocket | CORS configured for frontend |

---

## Post-Implementation

After completing this plan:
1. Update `docker-compose.yml` to uncomment vie-api
2. Run full verification checklist from IMPL-01
3. Create integration tests (future task)
4. Move to next track (vie-web or vie-summarizer)
