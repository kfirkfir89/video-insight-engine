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
│  • vie-explainer :8001      │
└─────────────────────────────┘
```

## Shared Package: packages/llm-common

Python package providing automatic LLM call tracking via LiteLLM callbacks.

| Module | Purpose |
|--------|---------|
| `models.py` | `UsageRecord` Pydantic model (20 fields) |
| `context.py` | `ContextVar` for feature, request_id, video_id |
| `buffer.py` | `SyncBuffer` (threading.Timer) + `AsyncBuffer` (asyncio) |
| `callback.py` | `MongoDBUsageCallback(CustomLogger)` with cost alerting |

Registered in:
- `services/summarizer/src/main.py` (sync mode)
- `services/explainer/src/server.py` (async mode)

## API Endpoints

### Usage Analytics (`/usage/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/usage/stats` | Aggregated totals (filters: days, feature, provider, service) |
| GET | `/usage/daily` | Daily breakdown for time-series charts |
| GET | `/usage/by-feature` | Cost per feature, sorted desc |
| GET | `/usage/by-model` | Cost per model, sorted desc |
| GET | `/usage/by-service` | Cost per service |
| GET | `/usage/by-video` | Top videos by total cost |
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
| `llm_usage` | 90 days | Callbacks (summarizer, explainer) | Admin |
| `llm_usage_daily` | None | Admin aggregator | Admin |
| `llm_alerts` | None | Callbacks + Admin | Admin |
| `health_history` | 30 days | Admin health poller | Admin |

## Environment Variables

```
ADMIN_API_KEY=<required>
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
VIE_API_URL=http://vie-api:3000
VIE_SUMMARIZER_URL=http://vie-summarizer:8000
VIE_EXPLAINER_URL=http://vie-explainer:8001
ALERT_COST_THRESHOLD_USD=0.50
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
