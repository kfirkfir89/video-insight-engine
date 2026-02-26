# Admin Panel — LLM Usage Monitoring & System Health

**Last Updated:** 2026-02-26

---

## Executive Summary

Build an admin service + dashboard to track LLM costs, monitor system health, and alert on anomalies. The project currently makes 5-15+ LLM calls per video summarization across two Python services with **zero production tracking**. Existing `UsageTracker` code in the summarizer is partially built but never wired into the actual LLM call path via LiteLLM callbacks.

**Approach:** Two parallel workstreams — (A) shared callback package that captures every LiteLLM call automatically, and (B) a standalone admin service with built-in React dashboard.

---

## Current State Analysis

### What Exists
- `UsageTracker` class in summarizer (`services/summarizer/src/services/usage_tracker.py`) — stores to `llm_usage` collection, has `track_success()`/`track_failure()`, basic indexes
- `complete_with_tracking()` in both services' `llm_provider.py` — returns `CompletionResult` with tokens/cost, but **callers don't use it for tracking**
- `litellm.completion_cost()` available for cost calculation
- MongoDB `llm_usage` collection with indexes on `(user_id, timestamp)`, `(timestamp)`, `(feature)`, `(provider)`
- Health endpoints on both services (`/health`) returning service name, model, DB status
- Request context middleware using structlog bound context (NOT Python ContextVars)
- `packages/` directory with `types/` and `utils/` (TypeScript only, no Python packages yet)

### What's Missing
- No LiteLLM callback integration — usage tracking requires manual calls that nobody makes
- No write batching — every track call is a separate MongoDB write
- No TTL on `llm_usage` — data grows unbounded
- No daily rollup aggregation for historical trends
- No admin service or dashboard
- No alerting for cost spikes
- No feature-level tracking (which pipeline phase costs what)
- No prompt deduplication detection
- No cross-service health monitoring

### Dead Code to Clean Up
- `UsageTracker` methods called nowhere in production pipeline
- `complete_with_tracking()` used only in some paths, tracking data discarded

---

## Proposed Future State

```
┌─────────────────┐  ┌─────────────────┐
│  vie-summarizer  │  │  vie-explainer   │
│  (LiteLLM calls) │  │  (LiteLLM calls) │
│  ┌────────────┐  │  │  ┌────────────┐  │
│  │  Callback  │──┼──┼──│  Callback  │  │
│  │  (shared)  │  │  │  │  (shared)  │  │
│  └────────────┘  │  │  └────────────┘  │
└────────┬─────────┘  └────────┬─────────┘
         │  imports from       │  imports from
         │  packages/llm-common│  packages/llm-common
         │  writes (batched)   │  writes (batched)
         ▼                     ▼
┌──────────────────────────────────────────┐
│  MongoDB                                 │
│  ├── llm_usage (TTL: 90 days)           │
│  ├── llm_usage_daily (permanent rollups) │
│  ├── llm_alerts                          │
│  └── health_history                      │
└──────────────────┬───────────────────────┘
                   │ reads from
         ┌─────────▼──────────┐
         │   vie-admin :8002  │──► polls /health every 30s
         │   (FastAPI)        │    stores in health_history
         │   + static React   │
         │   ADMIN_API_KEY    │
         └────────────────────┘
```

**Key design decisions:**
- Shared Python package (`packages/llm-common`) — avoids code duplication, baked into Docker images
- LiteLLM `CustomLogger` callback — automatic capture, zero changes to existing call sites
- Buffered writes — batch `insert_many` every 5s or 50 records to avoid per-call DB writes
- ContextVars for feature/request/video propagation — new, cleaner than structlog binding for LLM context
- Admin service serves its own React UI (multi-stage Dockerfile) — simple deployment, no CORS
- API key auth for admin — simple, sufficient for personal project

---

## Implementation Phases

### Phase 1: Shared Callback Package (Workstream A)
**Priority:** P0 — Must be done first, both workstreams depend on data flowing
**Effort:** L

#### Tasks

**A1. Create `packages/llm-common` package** (Effort: M)

1. Create `packages/llm-common/` directory structure with `pyproject.toml`, `src/llm_common/`
2. Implement `models.py` — `UsageRecord` Pydantic model with all fields (model, provider, tokens_in/out, cost_usd, feature, timestamp, success, duration_ms, request_id, video_id, is_stream, service, prompt_preview, prompt_hash, cache_hit, litellm_version, error_message)
3. Implement `context.py` — ContextVars: `llm_feature_var`, `llm_request_id_var`, `llm_video_id_var`
4. Implement `buffer.py` — Write batching with dual-mode support:
   - Sync mode (summarizer): background thread with `threading.Timer`, flush every 5s or 50 records
   - Async mode (explainer): `asyncio.create_task` with periodic flush
   - `_flush()` does `insert_many` for batched writes
   - `atexit` handler + lifespan shutdown hook for remaining records
5. Implement `callback.py` — `MongoDBUsageCallback(CustomLogger)`:
   - `async_log_success_event()`: extract model, tokens from `response.usage`, cost via `completion_cost()`, duration, prompt_preview (first 200 chars), prompt_hash (sha256), cache_hit, litellm version → buffer record
   - `async_log_failure_event()`: record error with model, duration
   - Proactive alerting: if single call cost > `ALERT_COST_THRESHOLD_USD` (env, default $0.50) → log WARNING + write to `llm_alerts`
   - All callback logic wrapped in try/except — never crashes the LLM call

**Acceptance criteria:**
- [ ] Package installable via `pip install -e ./packages/llm-common`
- [ ] Callback captures all LiteLLM fields correctly
- [ ] Buffer flushes on time/count threshold and shutdown
- [ ] Alert fires for expensive calls
- [ ] Zero impact on LLM call latency (async writes only)

**A2. Register callbacks at startup** (Effort: S)

1. Modify `services/summarizer/src/main.py` — register `MongoDBUsageCallback` with `litellm.callbacks` in sync mode
2. Modify `services/explainer/src/server.py` — register callback in lifespan with async mode
3. Modify `services/summarizer/Dockerfile` — `COPY packages/llm-common` + `pip install`
4. Modify `services/explainer/Dockerfile` — `COPY packages/llm-common` + `pip install`
5. Update `docker-compose.yml` — add volume mount for local dev (`pip install -e`)

**Acceptance criteria:**
- [ ] Both services register callback on startup
- [ ] Docker builds include the shared package
- [ ] Local dev uses editable install via volume mount

**A3. Feature context propagation** (Effort: S)

1. Modify `services/summarizer/src/routes/stream.py` — set `llm_feature_var` before each pipeline phase:
   - `summarize:detect_chapters`, `summarize:chapter`, `summarize:classify`, `summarize:facts`, `summarize:synthesis`
2. Modify `services/explainer/src/tools/explain_auto.py` — set `llm_feature_var` to `explain:auto`
3. Modify `services/explainer/src/tools/video_chat.py` — set `llm_feature_var` to `explain:chat`
4. Set `llm_video_id_var` and `llm_request_id_var` in request middleware for both services

**Acceptance criteria:**
- [ ] Every LLM call records which feature/phase initiated it
- [ ] Video ID and request ID propagated to usage records

**A4. MongoDB indexes + TTL** (Effort: S)

1. Fix date math bug in `usage_tracker.py` line ~160: `cutoff.day - days` → `timedelta(days=days)`
2. Add new indexes: `(cost_usd, -1)`, `(model, 1, timestamp, -1)`, `(video_id, 1)`, `(service, 1)`, `(prompt_hash, 1)`
3. Add TTL index: `(timestamp, 1)` with `expireAfterSeconds=7776000` (90 days)
4. Ensure indexes are created idempotently on startup

**Acceptance criteria:**
- [ ] Bug fixed
- [ ] All indexes created
- [ ] Old data auto-expires after 90 days

---

### Phase 2: Admin Backend (Workstream B1)
**Priority:** P0
**Effort:** L
**Depends on:** Phase 1 (needs data flowing)

#### Tasks

**B1. Admin service scaffolding** (Effort: M)

1. Create `services/admin/` directory structure
2. `pyproject.toml` — dependencies: fastapi, uvicorn, motor, httpx, cachetools, structlog, pydantic-settings
3. `src/main.py` — FastAPI app with CORS, routers, lifespan (health checker startup), static mount
4. `src/config.py` — Settings: `MONGODB_URI`, `ADMIN_API_KEY`, service URLs, alert thresholds
5. `src/auth.py` — API key middleware: checks `Authorization: Bearer <ADMIN_API_KEY>`, exempt `/health`
6. `src/dependencies.py` — Async Motor client, DI for database

**Acceptance criteria:**
- [ ] Service starts on port 8002
- [ ] `/health` accessible without auth
- [ ] All other routes require valid API key
- [ ] Returns 401 for missing/invalid key

**B2. Usage analytics endpoints** (Effort: L)

1. `GET /usage/stats?days=30&feature=&provider=&service=` — aggregated totals
2. `GET /usage/daily?days=30` — daily breakdown for time-series charts
3. `GET /usage/by-feature?days=30` — cost per feature, sorted desc
4. `GET /usage/by-model?days=30` — cost per model, sorted desc
5. `GET /usage/by-service?days=30` — cost per service
6. `GET /usage/by-video?days=30&limit=20` — top videos by total cost
7. `GET /usage/video/{video_id}` — all calls for a video with feature breakdown
8. `GET /usage/anomalies?threshold_usd=0.50&days=7` — expensive calls above threshold
9. `GET /usage/recent?limit=20&before_id=` — cursor-based pagination using ObjectId
10. `GET /usage/duplicates?days=7&min_count=3` — group by prompt_hash, show count + cost

- All `days` params capped at 90
- Expensive aggregation endpoints cached with `cachetools.TTLCache` (30-second TTL)

**Acceptance criteria:**
- [ ] All 10 endpoints return correct aggregated data
- [ ] Days param capped at 90
- [ ] Expensive queries cached
- [ ] Cursor-based pagination works correctly

**B3. Health monitoring** (Effort: M)

1. `src/services/health_checker.py` — polls all services every 30s via `asyncio.create_task`
   - httpx timeout: 5 seconds per service
   - Stores snapshots in `health_history` collection
   - Services: vie-api (:3000), vie-summarizer (:8000), vie-explainer (:8001), MongoDB (ping)
2. `GET /health/services` — current health of all services
3. `GET /health/overview` — aggregated system status
4. `GET /health/history?service=&hours=24` — health snapshots from `health_history`
5. `GET /health/uptime?service=&days=7` — uptime percentage calculation

**Acceptance criteria:**
- [ ] Health checker polls every 30s
- [ ] Snapshots stored with TTL (30 days)
- [ ] Uptime calculation correct
- [ ] Handles service unavailability gracefully (timeout, connection error)

**B4. Alert system** (Effort: S)

1. `GET /alerts/recent?limit=20` — recent alerts from `llm_alerts`
2. `POST /alerts/config` — update alert thresholds
3. `GET /alerts/config` — current thresholds
4. Alert conditions:
   - Single call cost > threshold (default $0.50)
   - Daily cost > 2x 7-day rolling average
   - Failure rate > 20% in last hour

**Acceptance criteria:**
- [ ] Alerts retrievable and configurable
- [ ] Threshold-based alerting works end-to-end

**B5. Daily aggregation** (Effort: S)

1. `POST /admin/aggregate-daily` — triggers rollup
2. Aggregates `llm_usage` → `llm_usage_daily`
3. Groups by: date, feature, model, provider, service
4. Stores: call_count, tokens_in, tokens_out, total_cost, avg_duration, success/failure counts
5. `llm_usage_daily` has no TTL — permanent historical data

**Acceptance criteria:**
- [ ] Rollup produces correct aggregated records
- [ ] Idempotent (re-running doesn't duplicate)
- [ ] Historical data persists past 90-day TTL

---

### Phase 3: Admin Frontend (Workstream B2)
**Priority:** P1
**Effort:** XL
**Depends on:** Phase 2 (needs API endpoints)

#### Tasks

**B6. React app scaffolding** (Effort: M)

1. Create `services/admin/ui/` with Vite + React + TypeScript
2. Dependencies: react, react-dom, react-router-dom, @tanstack/react-query, recharts, tailwindcss
3. `lib/api.ts` — API client with Bearer token from localStorage
4. `hooks/use-admin-api.ts` — TanStack Query hooks for all endpoints
5. `LoginPrompt.tsx` — API key input, stores in localStorage
6. `App.tsx` — Layout with react-router (Dashboard, Usage, Health, Alerts pages)

**Acceptance criteria:**
- [ ] App builds and serves correctly
- [ ] API client sends auth header
- [ ] Login prompt shows when no API key stored
- [ ] Navigation between pages works

**B7. Dashboard page** (Effort: L)

1. `StatsCards.tsx` — total cost today/week/month, call count, avg duration
2. `CostChart.tsx` — Recharts LineChart: daily cost trend
3. `AlertsBanner.tsx` — top-of-page alert strip
4. `FeatureBreakdown.tsx` — Recharts BarChart: cost by feature
5. `VideoCostTable.tsx` — top 5 most expensive videos
6. `ServiceHealth.tsx` — status cards per service (green/yellow/red)
7. Compose into `DashboardPage.tsx`

**Acceptance criteria:**
- [ ] Dashboard renders all widgets
- [ ] Charts display real data from API
- [ ] Auto-refresh on configurable interval
- [ ] Responsive layout

**B8. Usage detail page** (Effort: L)

1. `ModelBreakdown.tsx` — Recharts PieChart: cost by model
2. `ServiceBreakdown.tsx` — Recharts BarChart: cost by service
3. `RecentCalls.tsx` — paginated table with cursor-based pagination
4. `VideoCostDetail.tsx` — drill-down per-video feature cost breakdown
5. Duplicate prompt detection section
6. Compose into `UsagePage.tsx`

**Acceptance criteria:**
- [ ] All analytics views render correctly
- [ ] Pagination works with cursor
- [ ] Drill-down to video-level detail

**B9. Health & Alerts pages** (Effort: M)

1. `UptimeChart.tsx` — uptime history from health_history
2. `HealthPage.tsx` — service status grid + uptime chart
3. `AlertsList.tsx` — full alerts list with details
4. `AlertsPage.tsx` — alerts list + threshold config form

**Acceptance criteria:**
- [ ] Health status reflected accurately
- [ ] Uptime history chart renders
- [ ] Alert thresholds editable

---

### Phase 4: Docker Integration & Testing (Workstream B3)
**Priority:** P0
**Effort:** M
**Depends on:** Phase 2 + Phase 3

#### Tasks

**B10. Multi-stage Dockerfile** (Effort: S)

1. Stage 1: Build React with node:20-slim
2. Stage 2: Python + static files from stage 1
3. FastAPI serves static via `StaticFiles(directory="static", html=True)`

**B11. Docker Compose integration** (Effort: S)

1. Add `vie-admin` service to `docker-compose.yml`
2. Environment: MONGODB_URI, ADMIN_API_KEY, service URLs, alert thresholds
3. Depends on: vie-mongodb

**B12. Tests** (Effort: L)

1. Callback unit tests: mock collection, verify record fields
2. Buffer tests: count-based + time-based flush, shutdown flush
3. Alert tests: cost threshold triggering
4. Auth tests: 401/200 with/without API key
5. Usage API tests: seed data, verify aggregation + pagination
6. Health tests: mock services, verify snapshots and uptime
7. Aggregation tests: seed raw data, verify rollup records
8. Integration test: summarize video → verify `llm_usage` records → hit admin API

**Acceptance criteria:**
- [ ] >80% code coverage on new code
- [ ] All aggregation queries tested with seeded data
- [ ] Auth middleware tested for all paths
- [ ] Buffer edge cases covered (empty flush, shutdown during flush)

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Callback crashes LLM call | High | Low | All callback code in try/except, extensive testing |
| Buffer loses records on crash | Medium | Medium | Flush on shutdown (atexit), short buffer window (5s) |
| MongoDB aggregation perf on large datasets | Medium | Low | TTL + indexes + 30s cache on expensive queries |
| LiteLLM callback API changes | Low | Low | Pin LiteLLM version, test against specific version |
| Admin UI build bloats Docker image | Low | Medium | Multi-stage build, only ship dist/ folder |
| ContextVar not propagated in thread pools | Medium | Medium | Use sync callback mode for summarizer, test thread safety |

---

## Success Metrics

1. **Zero LLM calls go untracked** — every `litellm.acompletion()` and `litellm.completion()` generates a usage record
2. **Cost visibility** — can answer "how much did we spend today/this week/this month" in <2s
3. **Feature attribution** — can identify which pipeline phase costs the most
4. **Anomaly detection** — alerts fire within 30s of an expensive call
5. **Zero latency impact** — callback adds <5ms to any LLM call (async buffered writes)
6. **System health** — can see all service statuses at a glance, with uptime history

---

## Timeline Estimates

| Phase | Effort | Depends On |
|-------|--------|------------|
| Phase 1: Shared Callback Package | 1-2 sessions | — |
| Phase 2: Admin Backend | 1-2 sessions | Phase 1 |
| Phase 3: Admin Frontend | 2-3 sessions | Phase 2 |
| Phase 4: Docker + Tests | 1 session | Phase 2 + 3 |

**Total estimated:** 5-8 focused coding sessions
