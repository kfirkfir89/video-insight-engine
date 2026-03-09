# Admin Panel — Context

**Last Updated:** 2026-02-26

---

## Key Files

### Existing Code to Reuse/Modify

| File | Purpose | Action |
|------|---------|--------|
| `services/summarizer/src/services/usage_tracker.py` | Existing `UsageTracker`, `LLMUsageRecord` schema, `extract_provider()` | Reuse schema + provider extraction in shared package; fix date math bug |
| `services/summarizer/src/services/llm_provider.py` | `complete_with_tracking()` (line ~219) | Reference for field extraction patterns |
| `services/explainer/src/services/llm_provider.py` | `complete_with_tracking()` (line ~166) | Reference for field extraction patterns |
| `services/summarizer/src/main.py` | Summarizer startup, health endpoint | Add callback registration (+5 lines) |
| `services/explainer/src/server.py` | Explainer startup/lifespan, health endpoint | Add callback registration in lifespan (+5 lines) |
| `services/summarizer/src/routes/stream.py` | SSE pipeline with phases | Add `llm_feature_var.set()` before each phase |
| `services/explainer/src/tools/explain_auto.py` | Explain tool | Add feature context propagation |
| `services/explainer/src/tools/video_chat.py` | Chat tool | Add feature context propagation |
| `services/summarizer/src/dependencies.py` | Sync MongoDB client (pymongo) | Reference for admin service |
| `services/explainer/src/dependencies.py` | Async MongoDB client (Motor) | Reference for admin service |
| `services/summarizer/src/middleware.py` | Request context middleware (structlog) | Reference for adding ContextVar propagation |
| `services/explainer/src/middleware.py` | Request context middleware (structlog) | Reference for adding ContextVar propagation |
| `services/summarizer/src/config.py` | Settings pattern + MODEL_MAP | Reference for admin config |
| `services/explainer/src/config.py` | Settings pattern | Reference for admin config |
| `services/summarizer/Dockerfile` | Python 3.11-slim + ffmpeg | Add `COPY packages/llm-common` + `pip install` |
| `services/explainer/Dockerfile` | Python 3.11-slim | Add `COPY packages/llm-common` + `pip install` |
| `docker-compose.yml` | All service definitions | Add `vie-admin` service |
| `packages/types/src/index.ts` | Shared TS types (ContentBlock, etc.) | Reference only |

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/llm-common/pyproject.toml` | Python package config |
| `packages/llm-common/src/llm_common/__init__.py` | Package init |
| `packages/llm-common/src/llm_common/callback.py` | MongoDBUsageCallback (CustomLogger) ~100 lines |
| `packages/llm-common/src/llm_common/buffer.py` | Write batching ~80 lines |
| `packages/llm-common/src/llm_common/context.py` | ContextVars ~15 lines |
| `packages/llm-common/src/llm_common/models.py` | UsageRecord Pydantic model ~40 lines |
| `services/admin/pyproject.toml` | Admin service config |
| `services/admin/Dockerfile` | Multi-stage (React build + Python) |
| `services/admin/src/__init__.py` | Package init |
| `services/admin/src/main.py` | FastAPI app + static mount |
| `services/admin/src/config.py` | Admin settings |
| `services/admin/src/auth.py` | API key auth middleware |
| `services/admin/src/dependencies.py` | MongoDB DI |
| `services/admin/src/routes/usage.py` | Usage analytics endpoints ~200 lines |
| `services/admin/src/routes/health.py` | Health monitoring endpoints ~80 lines |
| `services/admin/src/routes/alerts.py` | Alert endpoints ~60 lines |
| `services/admin/src/services/health_checker.py` | Background health poller ~80 lines |
| `services/admin/src/services/aggregator.py` | Daily rollup aggregation ~60 lines |
| `services/admin/ui/` | Entire React app (Vite + React + TanStack Query + Recharts) |

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Shared package location | `packages/llm-common` (Python) | Follows existing `packages/` convention; first Python package there |
| Callback mechanism | LiteLLM `CustomLogger` | Automatic capture of ALL calls, zero changes to existing call sites |
| Write batching | In-memory buffer, flush every 5s or 50 records | Avoid per-call MongoDB writes; acceptable data loss window |
| Context propagation | Python `ContextVar` | Thread-safe, async-safe, no coupling to structlog |
| Admin auth | Simple API key (Bearer token) | Sufficient for personal project; avoid auth complexity |
| Admin UI deployment | Multi-stage Dockerfile (React built → served by FastAPI) | Single container, no CORS issues, simple deployment |
| Daily rollup | `llm_usage_daily` permanent collection | Survives 90-day TTL on raw data |
| Health polling | Background asyncio task (30s interval) | Simple, no external scheduler needed |

---

## Dependencies & External Libraries

### packages/llm-common
- `litellm` (already in both services)
- `pymongo` (for sync mode, already in summarizer)
- `motor` (for async mode, already in explainer)
- `pydantic` (already in both services)
- `structlog` (already in both services)

### services/admin (Backend)
- `fastapi` + `uvicorn`
- `motor` (async MongoDB)
- `httpx` (health check polling)
- `cachetools` (TTLCache for expensive aggregations)
- `structlog`
- `pydantic-settings`

### services/admin/ui (Frontend)
- `react` + `react-dom`
- `react-router-dom`
- `@tanstack/react-query`
- `recharts`
- `tailwindcss`

---

## MongoDB Collections

| Collection | Purpose | TTL | Written By | Read By |
|-----------|---------|-----|-----------|---------|
| `llm_usage` | Individual LLM call records | 90 days | Callbacks (summarizer, explainer) | Admin service |
| `llm_usage_daily` | Rolled-up daily aggregates | None (permanent) | Admin aggregator | Admin service |
| `llm_alerts` | Cost spike and anomaly alerts | None | Callbacks + Admin service | Admin service |
| `health_history` | Service health snapshots | 30 days | Admin health checker | Admin service |

### Indexes for `llm_usage`

Existing: `(user_id, timestamp)`, `(timestamp)`, `(feature)`, `(provider)`

New: `(cost_usd, -1)`, `(model, 1, timestamp, -1)`, `(video_id, 1)`, `(service, 1)`, `(prompt_hash, 1)`, TTL on `(timestamp, 1)`

---

## Environment Variables

### New (Admin Service)
```
ADMIN_API_KEY=<required>
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
VIE_API_URL=http://vie-api:3000
VIE_SUMMARIZER_URL=http://vie-summarizer:8000
VIE_EXPLAINER_URL=http://vie-explainer:8001
ALERT_COST_THRESHOLD_USD=0.50
```

### Modified (Existing Services)
```
ALERT_COST_THRESHOLD_USD=0.50  # New env var for callback alert threshold
```

---

## Pipeline Feature Tags

| Service | Feature Tag | Pipeline Phase |
|---------|------------|----------------|
| summarizer | `summarize:detect_chapters` | Chapter detection from transcript |
| summarizer | `summarize:chapter` | Individual chapter summarization |
| summarizer | `summarize:classify` | Content classification/persona |
| summarizer | `summarize:facts` | Fact extraction |
| summarizer | `summarize:synthesis` | Final synthesis (TL;DR, takeaways) |
| explainer | `explain:auto` | Section/concept documentation |
| explainer | `explain:chat` | Interactive video chat |

---

## Resolved Issues

1. ~~**Date math bug**~~ — Fixed in `usage_tracker.py`: `cutoff.replace(day=cutoff.day - days)` → `datetime.now(UTC) - timedelta(days=days)`
2. ~~**No ContextVar usage**~~ — ContextVars defined in `packages/llm-common/src/llm_common/context.py`
3. ~~**Summarizer uses sync pymongo**~~ — Dual-mode buffer: `SyncBuffer` (threading.Timer) for summarizer, `AsyncBuffer` (asyncio.create_task) for explainer
4. ~~**requirements.txt vs pyproject.toml**~~ — llm-common uses pyproject.toml, installed via pip in Dockerfiles

## Deferred Items

1. **Feature context propagation** (A3) — ContextVars are defined but not yet wired into pipeline phases. Requires integration testing with running services.
2. **Advanced alerting** (B4) — Daily cost spike detection and failure rate alerting deferred to post-MVP.

## Security Hardening Applied

- `hmac.compare_digest` for timing-safe API key comparison
- OpenAPI docs/redoc disabled (docs_url=None, redoc_url=None, openapi_url=None)
- CORS restricted to `localhost:5173` and `localhost:8002`
- Input validation (ObjectId, video_id length, date format) before DB access
- Auth middleware only exempts `/health` and `/assets/` paths
