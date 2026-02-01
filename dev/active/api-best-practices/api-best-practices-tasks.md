# API Best Practices Refactor - Tasks

**Last Updated:** 2026-02-01
**Total Tasks:** 31
**Estimated Effort:** XL (5-7 developer-days)

---

## Phase 1: Security Hardening (S - 2-3 hours)

### 1.1 Register Helmet Plugin
- [ ] Create `api/src/plugins/helmet.ts` with CSP config
- [ ] Register helmet in plugin chain (before routes)
- [ ] Verify headers: `curl -I /health | grep X-Frame`
- **Acceptance:** X-Frame-Options, HSTS, X-Content-Type-Options present
- **Effort:** S

### 1.2 Add Process Exception Handlers
- [ ] Create `api/src/server.ts` with process handlers
- [ ] Add `process.on('unhandledRejection')` with logging
- [ ] Add `process.on('uncaughtException')` with logging
- [ ] Move graceful shutdown from index.ts
- **Acceptance:** Unhandled errors logged before exit
- **Effort:** S

### 1.3 Add Graceful Shutdown
- [ ] Add SIGINT handler with `app.close()`
- [ ] Add SIGTERM handler with `app.close()`
- [ ] Log shutdown message
- **Acceptance:** `kill -15 <pid>` logs graceful shutdown
- **Effort:** S

### 1.4 Add Rate Limit to Playlist Import
- [ ] Add rate limit config to `/api/playlists/import` route
- [ ] Set limit: 5 imports per 24 hours per user
- **Acceptance:** 6th import returns 429
- **Effort:** S

### 1.5 Fix Exponential Backoff
- [ ] Open `api/src/services/summarizer-client.ts`
- [ ] Change line 86-88 from linear to exponential
- [ ] Replace `RETRY_DELAY_MS * attempt` with `RETRY_DELAY_MS * Math.pow(2, attempt - 1)`
- **Acceptance:** Delays are 1s, 2s, 4s (not 1s, 2s, 3s)
- **Effort:** S

### 1.6 Validate CORS Additional Origins
- [ ] Open `api/src/config.ts` line 41-44
- [ ] Add URL validation for CORS_ADDITIONAL_ORIGINS
- [ ] Use `z.string().url()` for each origin
- **Acceptance:** Invalid URLs rejected at startup
- **Effort:** S

---

## Phase 2: Bootstrap Refactor (M - 4-6 hours)

### 2.1 Create buildApp Function
- [ ] Create `api/src/app.ts`
- [ ] Move Fastify creation and plugin registration from index.ts
- [ ] Export `buildApp(options?: BuildAppOptions): Promise<FastifyInstance>`
- [ ] Add option for custom logger (for testing)
- **Acceptance:** `await buildApp()` returns configured Fastify instance
- **Effort:** M

### 2.2 Create Server Module
- [ ] Create `api/src/server.ts` (if not done in 1.2)
- [ ] Import and call `buildApp()`
- [ ] Call `app.listen()`
- [ ] Handle startup errors
- **Acceptance:** Server starts from server.ts
- **Effort:** S

### 2.3 Simplify index.ts
- [ ] Reduce index.ts to import and call server.ts
- [ ] Remove all Fastify configuration
- **Acceptance:** index.ts is <10 lines
- **Effort:** S

### 2.4 Create Service Container
- [ ] Create `api/src/container.ts`
- [ ] Define `Container` interface with all services/repos
- [ ] Create `createContainer(db, logger)` function
- [ ] Wire up all dependencies
- **Acceptance:** Container has all services with proper DI
- **Effort:** M

### 2.5 Decorate Container onto Fastify
- [ ] Add `app.decorate('container', container)` in app.ts
- [ ] Create type declaration for `fastify.container`
- [ ] Update `types/fastify.d.ts`
- **Acceptance:** `fastify.container.videoService` compiles
- **Effort:** S

### 2.6 Update Routes to Use Container
- [ ] Update `videos.routes.ts` to use `fastify.container.videoService`
- [ ] Update `folders.routes.ts` to use `fastify.container.folderService`
- [ ] Update `memorize.routes.ts` to use `fastify.container.memorizeService`
- [ ] Update `playlists.routes.ts` to use `fastify.container.playlistService`
- [ ] Update `auth.routes.ts` to use `fastify.container.authService`
- [ ] Remove `new Service()` calls from all routes
- **Acceptance:** No service instantiation in route handlers
- **Effort:** M
- **Depends On:** 2.4, 2.5

### 2.7 Create MongoDB Indexes on Ready
- [ ] Add `onReady` hook to mongodb.ts
- [ ] Create indexes per DATA-MODELS.md spec
- [ ] Log index creation
- **Acceptance:** Indexes visible in MongoDB Compass
- **Effort:** S

---

## Phase 3: Repository Layer (L - 8-12 hours)

### 3.1 Create VideoRepository
- [ ] Create `api/src/repositories/video.repository.ts`
- [ ] Move video collection queries from VideoService
- [ ] Add `findById`, `findByYoutubeId`, `create`, `update` methods
- [ ] Add `toEntity()` conversion (document → domain)
- **Acceptance:** VideoService uses VideoRepository
- **Effort:** M

### 3.2 Create FolderRepository
- [ ] Create `api/src/repositories/folder.repository.ts`
- [ ] Move folder queries from folder.service.ts
- [ ] Add CRUD + hierarchy methods
- [ ] Add `toEntity()` conversion
- **Acceptance:** FolderService uses FolderRepository
- **Effort:** M

### 3.3 Create MemorizeRepository
- [ ] Create `api/src/repositories/memorize.repository.ts`
- [ ] Move memorizedItems queries from MemorizeService
- [ ] Add CRUD + search methods
- [ ] Add `toEntity()` conversion
- **Acceptance:** MemorizeService uses MemorizeRepository
- **Effort:** M

### 3.4 Create UserRepository
- [ ] Create `api/src/repositories/user.repository.ts`
- [ ] Move user queries from AuthService
- [ ] Add `findByEmail`, `create` methods
- **Acceptance:** AuthService uses UserRepository
- **Effort:** S

### 3.5 Refactor VideoService
- [ ] Change constructor to receive `VideoRepository` + logger
- [ ] Remove all `db.collection()` calls
- [ ] Use repository methods instead
- [ ] Break up `createVideo()` into smaller methods
- **Acceptance:** No direct DB access in VideoService
- **Effort:** L

### 3.6 Refactor FolderService to Class
- [ ] Convert standalone functions to class
- [ ] Add constructor with `FolderRepository` + logger
- [ ] Use repository methods
- **Acceptance:** FolderService is a class with DI
- **Effort:** M

### 3.7 Refactor MemorizeService
- [ ] Update constructor to receive repositories + logger
- [ ] Remove `db.collection()` calls
- [ ] Replace generic `Error` with domain errors
- **Acceptance:** No direct DB access, all errors are domain-specific
- **Effort:** M

### 3.8 Refactor PlaylistService
- [ ] Change constructor to receive `VideoService`, `FolderService`, `SummarizerClient`, logger
- [ ] Remove direct `VideoService` instantiation
- **Acceptance:** PlaylistService receives all dependencies via DI
- **Effort:** S

### 3.9 Replace Console Loggers
- [ ] Update VideoService to use injected logger
- [ ] Update PlaylistService to use injected logger
- [ ] Update SummarizerClient to use injected logger
- [ ] Remove custom console logger objects
- **Acceptance:** All logs use Fastify logger with requestId
- **Effort:** M

### 3.10 Create Repository Index
- [ ] Create `api/src/repositories/index.ts`
- [ ] Export all repository classes
- **Acceptance:** Single import for repositories
- **Effort:** S

---

## Phase 4: Test Suite (L - 8-12 hours)

### 4.1 Set Up Vitest
- [ ] Add vitest, @vitest/coverage-v8 to devDependencies
- [ ] Create `vitest.config.ts` with coverage thresholds
- [ ] Add test scripts to package.json
- **Acceptance:** `npm test` runs vitest
- **Effort:** S

### 4.2 Create Test Setup
- [ ] Create `api/src/__tests__/setup.ts`
- [ ] Set up mongodb-memory-server
- [ ] Create test app builder helper
- [ ] Configure beforeAll/afterAll hooks
- **Acceptance:** Tests can use in-memory MongoDB
- **Effort:** M

### 4.3 Create Test Factories
- [ ] Create `factories/user.factory.ts`
- [ ] Create `factories/video.factory.ts`
- [ ] Create `factories/folder.factory.ts`
- [ ] Create `factories/memorize.factory.ts`
- **Acceptance:** Factories generate valid test data
- **Effort:** M

### 4.4 Write Route Integration Tests
- [ ] Write `auth.routes.test.ts` (register, login, refresh)
- [ ] Write `videos.routes.test.ts` (create, get, list)
- [ ] Write `folders.routes.test.ts` (create, update, delete)
- [ ] Write `memorize.routes.test.ts` (create, get, list)
- **Acceptance:** Route tests pass with 80%+ coverage
- **Effort:** L
- **Depends On:** 4.1, 4.2, 4.3

### 4.5 Write Service Unit Tests
- [ ] Write `video.service.test.ts` with mocked repository
- [ ] Write `folder.service.test.ts` with mocked repository
- [ ] Write `memorize.service.test.ts` with mocked repository
- **Acceptance:** Service tests pass with 80%+ coverage
- **Effort:** M
- **Depends On:** Phase 3 (repositories exist)

### 4.6 Write Repository Unit Tests
- [ ] Write `video.repository.test.ts`
- [ ] Write `folder.repository.test.ts`
- [ ] Write `memorize.repository.test.ts`
- **Acceptance:** Repository tests pass
- **Effort:** M
- **Depends On:** Phase 3

### 4.7 Configure CI Test Runner
- [ ] Add test step to CI workflow
- [ ] Fail CI if coverage < 80%
- [ ] Upload coverage report as artifact
- **Acceptance:** Tests run and pass in CI
- **Effort:** S

### 4.8 Add Pre-Commit Hook
- [ ] Add husky and lint-staged if not present
- [ ] Add pre-commit hook to run tests
- **Acceptance:** Commits blocked if tests fail
- **Effort:** S

---

## Summary

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| Phase 1: Security | 6 | S | Not Started |
| Phase 2: Bootstrap | 7 | M | Not Started |
| Phase 3: Repository | 10 | L | Not Started |
| Phase 4: Tests | 8 | L | Not Started |
| **Total** | **31** | **XL** | **0% Complete** |

---

## Quick Wins (Do First)
1. [ ] 1.1 Register Helmet Plugin
2. [ ] 1.2 Add Process Exception Handlers
3. [ ] 1.5 Fix Exponential Backoff
4. [ ] 1.4 Add Rate Limit to Playlist Import

---

## Notes

- Each phase builds on the previous
- Phase 1 can be done immediately without other changes
- Phase 2-3 are prerequisites for Phase 4
- Tests should be written alongside repository refactor
