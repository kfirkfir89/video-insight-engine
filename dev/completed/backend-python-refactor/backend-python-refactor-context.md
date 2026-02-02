# Backend Python Refactor - Context

Technical context, key files, and architectural decisions for the refactor.

**Last Updated**: 2026-02-01 (ALL PHASES COMPLETE)

---

## Current State: ALL PHASES COMPLETE ✅

### Explainer Service (Phases 1-3):
- ✅ Motor async MongoDB driver (replacing blocking PyMongo)
- ✅ FastAPI Dependency Injection with `Annotated[]` type aliases
- ✅ Repository pattern with Protocol interfaces
- ✅ Pydantic domain models for type safety

### Both Services (Phase 5 - Cross-Cutting):
- ✅ Structured logging with structlog (console/JSON modes)
- ✅ Request ID middleware (X-Request-ID header)
- ✅ Enhanced health checks with database status
- ✅ Health check verified: `{"status":"healthy","database":"connected"}`

### Phase 4 (Summarizer Stream Refactor): NOT NEEDED
After thorough review, `routes/stream.py` (929 lines) already follows best practices:
- Clear phase separation with async generator functions
- Single responsibility per function
- Route handler is thin (~55 lines)
- Dataclasses for pipeline state

---

## Key Files - CURRENT STATE

### Explainer Service (REFACTORED)

| File | Status | Purpose |
|------|--------|---------|
| `src/schemas.py` | ✅ NEW | Pydantic domain models (VideoSummary, Chat, MemorizedItem) |
| `src/dependencies.py` | ✅ NEW | FastAPI DI providers with Annotated type aliases |
| `src/repositories/base.py` | ✅ NEW | Repository protocols (VideoSummaryRepositoryProtocol, etc.) |
| `src/repositories/mongodb_repository.py` | ✅ NEW | Motor async implementations |
| `src/main.py` | ✅ UPDATED | Uses DI pattern, imports from schemas.py |
| `src/tools/explain_auto.py` | ✅ UPDATED | Pure function with injected deps |
| `src/tools/explain_chat.py` | ✅ UPDATED | Pure function with injected deps |
| `src/tools/explain_chat_stream.py` | ✅ UPDATED | Pure function with injected deps |
| `src/services/llm.py` | ✅ UPDATED | Removed singleton pattern |
| `src/services/mongodb.py` | ❌ DELETED | Replaced by repository layer |
| `tests/conftest.py` | ✅ UPDATED | Mock fixtures for DI testing |
| `tests/test_explain_auto.py` | ✅ UPDATED | Uses mock repositories |
| `tests/test_explain_chat.py` | ✅ UPDATED | Uses mock repositories |

### Summarizer Service (DEFERRED - Already Good)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `routes/stream.py` | 929 | DEFERRED | Already well-structured internally |
| `services/summarizer_service.py` | ~200 | GOOD | Proper pattern |
| `repositories/base.py` | ~50 | GOOD | Repository protocol |
| `dependencies.py` | ~100 | GOOD | Uses Depends() |

---

## Final Architecture (Explainer)

### Dependency Injection Pattern

```python
# dependencies.py - Type aliases for clean injection
from typing import Annotated
from fastapi import Depends

VideoSummaryRepoDep = Annotated[VideoSummaryRepositoryProtocol, Depends(get_video_summary_repo)]
ExpansionRepoDep = Annotated[ExpansionRepositoryProtocol, Depends(get_expansion_repo)]
MemorizedItemRepoDep = Annotated[MemorizedItemRepositoryProtocol, Depends(get_memorized_item_repo)]
ChatRepoDep = Annotated[ChatRepositoryProtocol, Depends(get_chat_repo)]
LLMServiceDep = Annotated[LLMService, Depends(get_llm_service)]
```

### Route Handler Pattern

```python
# main.py - Clean route with injected dependencies
@app.post("/explain/auto", response_model=ExplainAutoResponse)
async def explain_auto_endpoint(
    request: ExplainAutoRequest,
    video_summary_repo: VideoSummaryRepoDep,
    expansion_repo: ExpansionRepoDep,
    llm_service: LLMServiceDep,
):
    result = await explain_auto(
        video_summary_id=request.video_summary_id,
        target_type=request.target_type,
        target_id=request.target_id,
        video_summary_repo=video_summary_repo,
        expansion_repo=expansion_repo,
        llm_service=llm_service,
    )
    return ExplainAutoResponse(expansion=result)
```

### Repository Pattern

```python
# repositories/base.py - Protocol interface
@runtime_checkable
class VideoSummaryRepositoryProtocol(Protocol):
    async def find_by_id(self, video_summary_id: str) -> VideoSummary | None: ...

# repositories/mongodb_repository.py - Motor implementation
class VideoSummaryRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection("videoSummaries")

    async def find_by_id(self, video_summary_id: str) -> VideoSummary | None:
        doc = await self._collection.find_one({"_id": ObjectId(video_summary_id)})
        return self._to_entity(doc) if doc else None

    def _to_entity(self, doc: dict) -> VideoSummary:
        return VideoSummary(
            id=str(doc["_id"]),
            youtubeId=doc["youtubeId"],
            title=doc["title"],
            sections=[...],
        )
```

---

## Problems Solved This Session

### 1. Motor Not Installed in Container
After updating requirements.txt, the container still had old dependencies.
**Fix**: `docker compose build vie-explainer --no-cache` and restart.

### 2. ModuleNotFoundError for src.services.mongodb
The `services/__init__.py` still imported from deleted mongodb.py.
**Fix**: Updated `__init__.py` to only export LLMService and LLMProvider.

### 3. Type Error in explain_chat_stream.py
The `chat_id` parameter could be `None` but was yielded directly.
**Fix**: Introduced `active_chat_id: str` variable that's always assigned before use.

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Defer Phase 4 | Keep stream.py as-is | Already follows best practices internally |
| Defer Phase 5 | Skip structlog | Optional, lower priority |
| Domain models | Pydantic BaseModel | Type safety, validation |
| Entity mapping | `_to_entity()` methods | Clean separation of MongoDB docs from domain objects |

---

## Verification Commands

```bash
# Health check
curl http://localhost:8001/health
# Returns: {"status":"healthy","service":"vie-explainer","model":"gemini/gemini-3-flash-preview","database":"connected"}

# Check logs
docker compose logs vie-explainer --tail 30

# Restart service after changes
docker compose restart vie-explainer
```

---

## Task Complete

All phases of the backend-python-refactor are now complete:
- Phases 1-3: Explainer service refactored (Motor, DI, Repository pattern)
- Phase 4: NOT NEEDED (code already good)
- Phase 5: Cross-cutting improvements (structlog, middleware) for BOTH services

This task can be archived.

---

## Files Changed (All Sessions)

### Created - Explainer (Phases 1-3)
- `services/explainer/src/schemas.py`
- `services/explainer/src/dependencies.py`
- `services/explainer/src/repositories/__init__.py`
- `services/explainer/src/repositories/base.py`
- `services/explainer/src/repositories/mongodb_repository.py`

### Created - Cross-Cutting (Phase 5)
- `services/explainer/src/logging_config.py` - structlog configuration
- `services/explainer/src/middleware.py` - request ID middleware
- `services/summarizer/src/logging_config.py` - structlog configuration
- `services/summarizer/src/middleware.py` - request ID middleware

### Modified - Explainer (Phases 1-3)
- `services/explainer/requirements.txt` (pymongo → motor, +structlog)
- `services/explainer/pyproject.toml`
- `services/explainer/src/main.py` (DI + middleware)
- `services/explainer/src/config.py` (log_level, log_format)
- `services/explainer/src/tools/explain_auto.py`
- `services/explainer/src/tools/explain_chat.py`
- `services/explainer/src/tools/explain_chat_stream.py`
- `services/explainer/src/services/__init__.py`
- `services/explainer/src/services/llm.py`
- `services/explainer/src/services/llm_provider.py`
- `services/explainer/tests/conftest.py`
- `services/explainer/tests/test_explain_auto.py`
- `services/explainer/tests/test_explain_chat.py`

### Modified - Summarizer (Phase 5)
- `services/summarizer/requirements.txt` (+structlog)
- `services/summarizer/src/main.py` (middleware + enhanced health)
- `services/summarizer/src/config.py` (log_level, log_format)

### Deleted - Explainer
- `services/explainer/src/services/mongodb.py`
- `services/explainer/tests/test_mongodb.py`

---

## Integration Points (No Changes)

The refactor was internal only - no API changes:
- `vie-api` calls to explainer endpoints work unchanged
- SSE streaming still works
- MongoDB connection now async but same collections/queries
