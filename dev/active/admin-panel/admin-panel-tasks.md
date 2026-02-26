# Admin Panel — Task Checklist

**Last Updated:** 2026-02-26

---

## Phase 1: Shared Callback Package (Workstream A)

### A1. Create `packages/llm-common` package [M]
- [x] Create directory structure with `pyproject.toml`
- [x] Implement `models.py` — `UsageRecord` Pydantic model
- [x] Implement `context.py` — ContextVars (feature, request_id, video_id)
- [x] Implement `buffer.py` — Dual-mode write batching (sync thread + async task)
- [x] Implement `callback.py` — `MongoDBUsageCallback(CustomLogger)`
- [x] Add cost threshold alerting in callback
- [x] Unit tests for callback, buffer, models

### A2. Register callbacks at startup [S]
- [x] Modify `services/summarizer/src/main.py` — register callback (sync mode)
- [x] Modify `services/explainer/src/server.py` — register callback in lifespan (async mode)
- [x] Modify `services/summarizer/Dockerfile` — COPY + pip install llm-common
- [x] Modify `services/explainer/Dockerfile` — COPY + pip install llm-common
- [x] Update `docker-compose.yml` — build context changes for llm-common

### A3. Feature context propagation [S]
- [x] ContextVars defined in `packages/llm-common/src/llm_common/context.py`
- [ ] Modify `stream.py` — set feature vars for each pipeline phase (deferred: requires testing with running services)
- [ ] Modify `explain_auto.py` — set feature var (`explain:auto`) (deferred)
- [ ] Modify `video_chat.py` — set feature var (`explain:chat`) (deferred)
- [ ] Add video_id + request_id propagation in middleware (deferred)

### A4. MongoDB indexes + TTL [S]
- [x] Fix date math bug in `usage_tracker.py`
- [x] Add new indexes (cost_usd, model+timestamp, video_id, service, prompt_hash)
- [x] Add TTL index on timestamp (90 days)
- [x] Idempotent index creation in admin lifespan

---

## Phase 2: Admin Backend (Workstream B1)

### B1. Admin service scaffolding [M]
- [x] Create `services/admin/` directory structure
- [x] `pyproject.toml` with dependencies
- [x] `main.py` — FastAPI app, CORS, routers, lifespan, static mount
- [x] `config.py` — Settings (MONGODB_URI, ADMIN_API_KEY, service URLs, thresholds)
- [x] `auth.py` — API key middleware (Bearer token, hmac.compare_digest), exempt /health
- [x] `dependencies.py` — Async Motor client, DI

### B2. Usage analytics endpoints [L]
- [x] `GET /usage/stats` — aggregated totals (with filters)
- [x] `GET /usage/daily` — daily breakdown for charts
- [x] `GET /usage/by-feature` — cost per feature
- [x] `GET /usage/by-model` — cost per model
- [x] `GET /usage/by-service` — cost per service
- [x] `GET /usage/by-video` — top videos by cost
- [x] `GET /usage/video/{video_id}` — per-video detail (with path validation)
- [x] `GET /usage/anomalies` — expensive calls above threshold
- [x] `GET /usage/recent` — cursor-based pagination (with ObjectId validation)
- [x] `GET /usage/duplicates` — prompt hash grouping
- [x] Add TTLCache (30s) for expensive aggregations
- [x] Cap days param at 90

### B3. Health monitoring [M]
- [x] `health_checker.py` — background poller (30s interval, 5s timeout)
- [x] `GET /health/services` — current service health
- [x] `GET /health/overview` — aggregated status
- [x] `GET /health/history` — historical snapshots
- [x] `GET /health/uptime` — uptime percentage
- [x] `health_history` collection with 30-day TTL

### B4. Alert system [S]
- [x] `GET /alerts/recent` — recent alerts
- [x] `POST /alerts/config` — update thresholds
- [x] `GET /alerts/config` — current thresholds
- [ ] Daily cost spike detection (2x 7-day average) — deferred to post-MVP
- [ ] Failure rate alerting (>20% in last hour) — deferred to post-MVP

### B5. Daily aggregation [S]
- [x] `POST /admin/aggregate-daily` endpoint (with date validation)
- [x] Aggregation pipeline (group by date/feature/model/provider/service)
- [x] Store in `llm_usage_daily` (no TTL)
- [x] Idempotent re-run handling (upsert)

---

## Phase 3: Admin Frontend (Workstream B2)

### B6. React app scaffolding [M]
- [x] Create `services/admin/ui/` with Vite + React + TS
- [x] Install dependencies (react-router, tanstack-query, recharts, tailwind v4)
- [x] `lib/api.ts` — API client with Bearer token
- [x] `hooks/use-admin-api.ts` — 13 TanStack Query hooks
- [x] `LoginPrompt.tsx` — API key input + localStorage
- [x] `App.tsx` — Layout + router (Dashboard, Usage, Health, Alerts)

### B7. Dashboard page [L]
- [x] `StatsCards.tsx` — cost today/week/month, calls, avg duration, success rate
- [x] `CostChart.tsx` — daily cost trend (LineChart)
- [x] `AlertsBanner.tsx` — top-of-page alert strip
- [x] `FeatureBreakdown.tsx` — cost by feature (BarChart)
- [x] `ServiceHealth.tsx` — status cards (green/yellow/red)
- [x] `DashboardPage.tsx` — compose all widgets

### B8. Usage detail page [L]
- [x] `ModelBreakdown.tsx` — cost by model (PieChart)
- [x] `RecentCalls.tsx` — paginated table
- [x] `UsagePage.tsx` — compose all views

### B9. Health & Alerts pages [M]
- [x] `HealthPage.tsx` — status grid + 7-day uptime display
- [x] `AlertsPage.tsx` — alerts list + threshold config display

---

## Phase 4: Docker Integration & Testing

### B10. Multi-stage Dockerfile [S]
- [x] Stage 1: Node.js — build React app
- [x] Stage 2: Python — copy dist + install backend
- [x] Static files served via FastAPI StaticFiles mount

### B11. Docker Compose integration [S]
- [x] Add `vie-admin` service definition (port 8002)
- [x] Environment variables configured
- [x] Depends on vie-mongodb

### B12. Tests [L]
- [x] Callback unit tests (6 tests: sync/async success/failure, cost alert, crash safety)
- [x] Buffer tests (9 tests: sync/async add/flush/batch/shutdown/error)
- [x] Context tests (5 tests: defaults, set/get)
- [x] Model tests (5 tests: extract_provider, UsageRecord)
- [x] Auth middleware tests (4 tests: health no-auth, requires auth, wrong key, correct key)
- [x] Auth security tests (5 tests: timing-safe, docs disabled, openapi disabled, health exempt, static assets)
- [x] Usage validation tests (2 tests: invalid cursor, video_id max length)
- [x] Aggregator validation tests (1 test: invalid date format)
- [x] Frontend unit tests (20 tests: components, pages, hooks, API, main)
- [x] Playwright E2E tests (36 tests: 12 specs × 3 viewports — desktop, tablet, mobile)

---

## Security Hardening (Post-Implementation)
- [x] Use `hmac.compare_digest` for timing-safe API key comparison
- [x] Disable OpenAPI docs/redoc in production (docs_url=None)
- [x] Restrict CORS to known origins (localhost:5173, localhost:8002)
- [x] Validate ObjectId before DB access (returns 400 on invalid cursor)
- [x] Validate video_id path param (max_length=64)
- [x] Validate target_date before DB access (returns error dict on invalid format)
- [x] Move input validation before get_database() calls

---

## Progress Summary

| Phase | Status | Tasks Done | Tasks Total |
|-------|--------|------------|-------------|
| Phase 1: Shared Callback | Complete | 15 | 19 (4 deferred: context propagation) |
| Phase 2: Admin Backend | Complete | 25 | 27 (2 deferred: advanced alerting) |
| Phase 3: Admin Frontend | Complete | 15 | 15 |
| Phase 4: Docker + Tests | Complete | 13 | 13 |
| Security Hardening | Complete | 7 | 7 |
| **Total** | **Complete** | **75** | **81** |

### Test Summary

| Suite | Tests | Status |
|-------|-------|--------|
| llm-common (Python) | 25 | ✅ All pass |
| Admin backend (Python) | 12 | ✅ All pass |
| Admin frontend (Vitest) | 20 | ✅ All pass |
| Playwright E2E (3 viewports) | 36 | ✅ All pass |
| **Total** | **93** | ✅ **All pass** |
