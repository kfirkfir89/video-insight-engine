# Service: vie-admin

LLM usage monitoring, system health dashboard, and cost alerting service.

## Overview

| Property | Value |
|----------|-------|
| Port | 8002 |
| Framework | FastAPI + React (multi-stage Docker) |
| Auth | API key (Bearer token) |
| Database | MongoDB (shared with other services) |

## Architecture

```
┌─────────────────────────────┐
│      vie-admin :8002        │
│  ┌───────────┐ ┌──────────┐│
│  │  FastAPI   │ │ React UI ││
│  │  Backend   │ │ (static) ││
│  └─────┬─────┘ └──────────┘│
│        │                    │
│  Reads from MongoDB:        │
│  • llm_usage (90d TTL)      │
│  • llm_usage_daily          │
│  • llm_alerts               │
│  • health_history (30d TTL) │
│        │                    │
│  Polls /health endpoints:   │
│  • vie-api :3000            │
│  • vie-summarizer :8000     │
│  • vie-assistant :8001      │
└─────────────────────────────┘
```

## Shared Package: packages/llm-common

Python package providing automatic LLM call tracking via LiteLLM callbacks.

| Module | Purpose |
|--------|---------|
| `models.py` | `UsageRecord` Pydantic model (25 fields incl. `cache_*`, plus `unit`/`audio_seconds` for transcription) + `compute_cache_savings_usd(model, tokens)` (backed by `_CACHE_RATES_USD_PER_M`) and `compute_transcription_cost_usd(model, ...)` (backed by `_TRANSCRIPTION_RATES_USD` — Whisper $0.006/min, Gemini per-token) helpers |
| `context.py` | `ContextVar`s for feature, request_id, video_id, user_id, video_summary_id |
| `buffer.py` | `SyncBuffer` (threading.Timer) + `AsyncBuffer` (asyncio) |
| `callback.py` | `MongoDBUsageCallback(CustomLogger)` with cost alerting; `register_active_buffer` + `record_manual_usage(record)` for out-of-band emits (transcription bypasses LiteLLM) |

Registered in:
- `services/summarizer/src/main.py` (sync mode)
- `services/assistant/src/server.py` (async mode)

## API Endpoints

### Usage Analytics (`/usage/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/usage/stats` | Aggregated totals (filters: days, feature, provider, service) |
| GET | `/usage/daily` | Daily breakdown for time-series charts |
| GET | `/usage/by-feature` | Cost per feature, sorted desc |
| GET | `/usage/by-model` | Cost per model, sorted desc |
| GET | `/usage/by-service` | Cost per service |
| GET | `/usage/by-video` | Top videos by total cost (latest cache version only — `isLatest` lookup avoids duplicate rows from versioned/dedup'd docs) |
| GET | `/usage/by-run` | Pipeline runs grouped by `request_id`, newest first; each run carries `regen_ordinal` (1 = first run, 2+ = regeneration), a best-effort `langfuse_url` (direct trace deep-link, null when unconfigured/unresolvable), and child calls. Paginated (`days`, `limit`, `offset`). Rows missing `request_id` → "unattributed (legacy)" bucket |
| GET | `/usage/video/{video_id}` | Per-video feature breakdown |
| GET | `/usage/anomalies` | Expensive calls above threshold |
| GET | `/usage/recent` | Cursor-based pagination (before_id) |
| GET | `/usage/duplicates` | Group by prompt_hash, find duplicates |

### Health Monitoring (`/health/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Basic health check (no auth required) |
| GET | `/health/services` | Current health of all services |
| GET | `/health/overview` | Aggregated system status |
| GET | `/health/history` | Historical health snapshots |
| GET | `/health/uptime` | Uptime percentage calculation |

### Alerts (`/alerts/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/alerts/recent` | Recent cost/anomaly alerts |
| GET | `/alerts/config` | Current alert thresholds |
| POST | `/alerts/config` | Update alert thresholds |

### Admin (`/admin/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/aggregate-daily` | Trigger daily rollup aggregation |

### Per-User Costs (`/users/`)

Backs the **Users** page in the admin dashboard. Reads `userCosts` (per-user
daily aggregates) and `userCostAdjustments` (admin audit log). See
[Data Models — userCosts](./DATA-MODELS.md#usercosts).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/costs?days=7&limit=50&offset=0` | Top users by effective USD over the trailing window (joins `users` for email/name/tier) |
| GET | `/users/{user_id}/costs?days=30` | One user's daily breakdown + last 20 audit rows |
| GET | `/users/{user_id}/activity?days=30` | User-360: videos generated (`userVideos` join), assistant LLM calls (`llm_usage` where `user_id`), and daily cost timeline — all in one payload |
| POST | `/users/{user_id}/grant-credit` | Apply a signed adjustment; `amountUsd > 0` grants credit (stored as negative), `< 0` is a manual charge. Validated: `|amountUsd| ≤ 1000`, `reason` 1–500 chars, optional `date` (`YYYY-MM-DD`) |

**Audit caveat:** the admin service authenticates with a shared
`ADMIN_API_KEY`, so `adminId` in the grant-credit request body is
self-attested. Acceptable for a single-admin team; swap for per-admin
credentials if you need a forgery-resistant audit log.

## Frontend

React SPA served as static files from the same container.

| Technology | Version |
|------------|---------|
| React | 19.x |
| React Router | 7.x |
| TanStack Query | 5.x |
| Recharts | 3.x |
| Tailwind CSS | 4.x |

### Pages

- **Dashboard** — StatsCards, ServiceHealth, CostChart, FeatureBreakdown, AlertsBanner
- **Usage** — CostChart, ModelBreakdown, FeatureBreakdown, RecentCalls
- **Health** — ServiceHealth, 7-day uptime grid
- **Alerts** — Alert thresholds, recent alerts table

## Security

- API key auth via `Authorization: Bearer <key>` header
- Timing-safe comparison (`hmac.compare_digest`)
- OpenAPI docs disabled in production
- CORS restricted to known origins
- Input validation on all parameters (ObjectId, path params, date formats)
- TTLCache (30s) prevents aggregation query abuse

## MongoDB Collections

| Collection | TTL | Written By | Read By |
|-----------|-----|-----------|---------|
| `llm_usage` | 90 days | Callbacks (summarizer, assistant) | Admin |
| `llm_usage_daily` | None | Admin aggregator | Admin |
| `llm_alerts` | None | Callbacks + Admin | Admin |
| `health_history` | 30 days | Admin health poller | Admin |

## Environment Variables

```
ADMIN_API_KEY=<required>
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
VIE_API_URL=http://vie-api:3000
VIE_SUMMARIZER_URL=http://vie-summarizer:8000
VIE_ASSISTANT_URL=http://vie-assistant:8001
ALERT_COST_THRESHOLD_USD=0.50
# Langfuse — read-only, only to build "Open in Langfuse" run deep-links.
# Project id auto-resolved from the keys when LANGFUSE_PROJECT_ID is blank.
# All optional: unset → /usage/by-run simply returns langfuse_url=null.
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_PROJECT_ID=
```

## Testing

```bash
# Backend tests
cd services/admin && python3 -m pytest tests/ -v

# Frontend unit tests
cd services/admin/ui && npx vitest run

# E2E tests (3 viewports: desktop, tablet, mobile)
cd services/admin/ui && npx playwright test
```
