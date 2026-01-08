# Tasks: vie-api Implementation

> **Last Updated:** 2026-01-08
> **Status:** COMPLETE

---

## Phase 1: Project Setup

- [x] **1.1** Create `api/package.json` with all dependencies
- [x] **1.2** Create `api/tsconfig.json` with ES2022/NodeNext config
- [x] **1.3** Create directory structure (src/plugins, routes, services, schemas, utils)
- [x] **1.4** Run `pnpm install` in api/

**Phase 1 Verification:**
- [x] `cd api && pnpm install` completes without errors
- [x] Directory structure matches architecture diagram

---

## Phase 2: Core Infrastructure

- [x] **2.1** Create `api/src/config.ts` with Zod environment validation
- [x] **2.2** Create `api/src/index.ts` entry point with Fastify instance
- [x] **2.3** Create `api/src/plugins/mongodb.ts` with connection and health check
- [x] **2.4** Create `api/src/plugins/jwt.ts` with authenticate decorator
- [x] **2.5** Create `api/src/plugins/cors.ts` with frontend origin
- [x] **2.6** Create `api/src/plugins/rate-limit.ts` with global 100/min limit

**Phase 2 Verification:**
- [x] `pnpm dev` starts without errors
- [x] `curl http://localhost:3000/health` returns `{"status":"ok"}`
- [x] MongoDB connection logged as successful

---

## Phase 3: Authentication System

- [x] **3.1** Create `api/src/schemas/auth.schema.ts` with register/login validation
- [x] **3.2** Create `api/src/services/auth.service.ts` with register, login, getUser
- [x] **3.3** Create `api/src/routes/auth.routes.ts` with all 5 endpoints
- [x] **3.4** Add per-route rate limits (register: 5/hr, login: 10/15min)

**Phase 3 Verification:**
- [x] `POST /api/auth/register` returns accessToken and sets cookie
- [x] `POST /api/auth/login` returns accessToken and sets cookie
- [x] `POST /api/auth/refresh` returns new accessToken
- [x] `POST /api/auth/logout` clears cookie
- [x] `GET /api/auth/me` returns user data (with valid token)
- [x] `GET /api/auth/me` returns 401 (without token)

---

## Phase 4: Video Management

- [x] **4.1** Create `api/src/utils/youtube.ts` with URL extraction
- [x] **4.2** Create `api/src/services/summarizer-client.ts` with HTTP trigger
- [x] **4.3** Create `api/src/services/video.service.ts` with cache-first logic
- [x] **4.4** Create `api/src/routes/videos.routes.ts` with CRUD endpoints
- [x] **4.5** Add rate limit to POST /videos (10/24hr per user)

**Phase 4 Verification:**
- [x] `POST /api/videos` with valid YouTube URL returns video with status "pending"
- [x] `POST /api/videos` with invalid URL returns 400
- [x] `GET /api/videos` returns user's video list
- [x] `GET /api/videos/:id` returns video details
- [x] `DELETE /api/videos/:id` returns 204
- [x] Duplicate URL returns cached result (if completed)

---

## Phase 5: Stub Routes

- [x] **5.1** Create `api/src/routes/folders.routes.ts` (stub)
- [x] **5.2** Create `api/src/routes/memorize.routes.ts` (stub)
- [x] **5.3** Create `api/src/routes/explain.routes.ts` (stub)

**Phase 5 Verification:**
- [x] `GET /api/folders` returns `{ folders: [] }`
- [x] `POST /api/folders` returns `{ id: 'stub' }`
- [x] `GET /api/memorize` returns `{ items: [] }`
- [x] `POST /api/memorize` returns `{ id: 'stub' }`
- [x] `GET /api/explain/:id/:type/:targetId` returns placeholder

---

## Phase 6: WebSocket

- [x] **6.1** Create `api/src/plugins/websocket.ts` with token auth
- [x] **6.2** Add broadcast decorator to Fastify instance

**Phase 6 Verification:**
- [x] WebSocket connects to `/ws?token=<valid>` and receives `{ type: 'connected' }`
- [x] WebSocket with invalid token closes with code 4001
- [x] `fastify.broadcast(userId, event)` sends to correct connection

---

## Phase 7: Containerization

- [x] **7.1** Create `api/Dockerfile` with multi-stage build
- [x] **7.2** vie-api already configured in `docker-compose.yml`
- [ ] **7.3** Test container build and startup (deferred - requires all deps)

**Phase 7 Verification:**
- [ ] `docker build -t vie-api api/` completes successfully
- [ ] `docker-compose up vie-api` starts the service
- [ ] Container health check passes
- [ ] Container connects to MongoDB

---

## Final Verification Checklist

From IMPL-01-API.md:

- [x] `pnpm dev` starts vie-api on port 3000
- [x] Health check returns `{"status":"ok","timestamp":"..."}`
- [x] Register flow works end-to-end
- [x] Login flow works end-to-end
- [x] Token refresh works
- [x] Video submission works
- [x] Video listing works
- [x] TypeScript compiles with zero errors (`pnpm typecheck`)
- [ ] Docker container builds and runs (deferred)

---

## Notes & Blockers

```
[2026-01-08] - Added JWT_REFRESH_SECRET to .env file
[2026-01-08] - Added ws package as explicit dependency
[2026-01-08] - Fixed JWT type declarations for userId property
[2026-01-08] - All core functionality verified working
```

---

## Progress Summary

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Project Setup | Complete | 4/4 |
| 2. Core Infrastructure | Complete | 6/6 |
| 3. Authentication | Complete | 4/4 |
| 4. Video Management | Complete | 5/5 |
| 5. Stub Routes | Complete | 3/3 |
| 6. WebSocket | Complete | 2/2 |
| 7. Containerization | Partial | 2/3 |
| **Total** | **Complete** | **26/27** |
