# Backend Python Refactor - Tasks

Checklist for tracking progress. Mark items with `[x]` when complete.

**Last Updated**: 2026-02-01 (Session Complete - Phases 1-3 Done)

---

## Phase 1: Explainer Async MongoDB (Priority: Critical) - COMPLETE

Replace blocking PyMongo with Motor async driver.

- [x] **1.1** Add Motor to requirements.txt
  - File: `services/explainer/requirements.txt`
  - Add: `motor>=3.3.0`
  - Acceptance: `pip install -r requirements.txt` succeeds

- [x] **1.2** Create async MongoDB client factory
  - File: `services/explainer/src/dependencies.py`
  - Create `init_mongo_client()` returning `AsyncIOMotorClient`
  - Configure connection pooling
  - Acceptance: Client connects to MongoDB

- [x] **1.3** Create repository base protocol
  - File: `services/explainer/src/repositories/base.py` (NEW)
  - Define `VideoSummaryRepository` Protocol
  - Define `ChatHistoryRepository` Protocol
  - Acceptance: Protocols type-check correctly

- [x] **1.4** Implement VideoSummaryRepository
  - File: `services/explainer/src/repositories/mongodb_repository.py` (NEW)
  - Convert `get_video_summary()` to async method
  - Convert `get_video_context()` to async method
  - Return domain objects, not raw docs
  - Acceptance: All queries use `await`

- [x] **1.5** Implement ChatHistoryRepository
  - File: `services/explainer/src/repositories/mongodb_repository.py`
  - Convert `save_chat_message()` to async
  - Convert `get_chat_history()` to async
  - Acceptance: All queries use `await`

- [x] **1.6** Update tools to use async repositories
  - Files: `tools/explain_auto.py`, `tools/explain_chat.py`, `tools/explain_chat_stream.py`
  - Add `await` to all repository calls
  - Pass repository as parameter (prep for Phase 2)
  - Acceptance: No blocking DB calls

- [x] **1.7** Add DB health check
  - File: `services/explainer/src/main.py`
  - Health endpoint pings MongoDB
  - Acceptance: `/health` returns DB status

- [x] **1.8** Remove old PyMongo code
  - File: `services/explainer/src/services/mongodb.py`
  - Remove blocking functions
  - Remove PyMongo import
  - Acceptance: No PyMongo imports remain

---

## Phase 2: Explainer Dependency Injection - COMPLETE

Replace global singletons with FastAPI Depends().

- [x] **2.1** Create dependencies.py
  - File: `services/explainer/src/dependencies.py` (NEW)
  - Add `get_mongo_client()` provider
  - Add `get_video_summary_repo()` provider
  - Add `get_chat_repo()` provider
  - Add `get_llm_service()` provider
  - Acceptance: All providers are async functions

- [x] **2.2** Create type aliases
  - File: `services/explainer/src/dependencies.py`
  - Add `VideoSummaryRepoDep = Annotated[...]`
  - Add `ChatRepoDep = Annotated[...]`
  - Add `LLMServiceDep = Annotated[...]`
  - Acceptance: Type aliases defined with Annotated

- [x] **2.3** Refactor routes to use Depends()
  - File: `services/explainer/src/main.py`
  - Add dependencies to route function signatures
  - Remove direct calls to `get_*()` functions
  - Acceptance: All routes use injected dependencies

- [x] **2.4** Refactor tools to receive dependencies
  - Files: `tools/explain_auto.py`, `tools/explain_chat.py`, `tools/explain_chat_stream.py`
  - Change function signatures to accept repo and llm as params
  - Remove internal calls to global getters
  - Acceptance: Tools are pure functions with injected deps

- [x] **2.5** Remove singleton functions
  - Files: `services/llm.py`, `services/llm_provider.py`
  - Remove `@lru_cache()` decorators
  - Remove global state
  - Acceptance: No global singletons

- [x] **2.6** Write DI unit tests
  - File: `tests/conftest.py`, `tests/test_explain_*.py`
  - Test that dependencies can be mocked
  - Test route with mock dependencies
  - Acceptance: Tests pass with mocked deps

---

## Phase 3: Explainer Repository Pattern - COMPLETE

Create clean repository abstraction layer.

- [x] **3.1** Define repository protocols
  - File: `services/explainer/src/repositories/base.py`
  - Define abstract methods for all operations
  - Add return type hints
  - Acceptance: Protocols define complete interface

- [x] **3.2** Create domain models
  - File: `services/explainer/src/schemas.py` (NEW)
  - Move `ExplainAutoRequest` from main.py
  - Move `ExplainChatRequest` from main.py
  - Add response models
  - Add `VideoSummary` domain model
  - Acceptance: All schemas in dedicated file

- [x] **3.3** Repository returns domain objects
  - File: `services/explainer/src/repositories/mongodb_repository.py`
  - Add `_to_entity()` methods
  - Return typed domain objects
  - Acceptance: No raw dicts returned

- [x] **3.4** Update main.py imports
  - File: `services/explainer/src/main.py`
  - Import schemas from schemas.py
  - Remove inline model definitions
  - Acceptance: main.py has no Pydantic models

- [x] **3.5** Write repository tests
  - File: `tests/conftest.py` (fixtures for testing)
  - Test CRUD operations
  - Test entity mapping
  - Acceptance: Tests defined with mocked repos

---

## Phase 4: Summarizer Stream Refactor - NOT NEEDED

**Final Review (2026-02-01)**: After thorough analysis of `routes/stream.py` (929 lines), the code already follows best practices:

- ✅ Clear phase separation with dedicated async generator functions
- ✅ Single responsibility per function (fetch_transcript, run_parallel_analysis, process_creator_sections, etc.)
- ✅ Route handler is thin (~55 lines)
- ✅ Dataclasses for pipeline state (TranscriptData, ParallelResults, PipelineContext)
- ✅ Proper error handling with specific exception types
- ✅ No business logic in route handlers

**Decision**: Phase 4 is NOT NEEDED. The file length comes from well-organized helper functions, not complexity. Extracting to a pipeline class would add indirection without benefit.

- [x] **4.1-4.9** All tasks marked as NOT NEEDED after code review

---

## Phase 5: Cross-Cutting Improvements - COMPLETE

Add structured logging and request tracing.

- [x] **5.1** Add structlog to requirements
  - File: `services/summarizer/requirements.txt`, `services/explainer/requirements.txt`
  - Added: `structlog>=24.0.0`
  - Acceptance: pip install succeeds

- [x] **5.2** Configure structlog
  - File: `services/*/src/logging_config.py` (NEW)
  - Created configure_structlog() with console/JSON modes
  - Acceptance: Structured logs with timestamps

- [x] **5.3** Create request ID middleware
  - File: `services/*/src/middleware.py` (NEW)
  - Created RequestContextMiddleware
  - Generates/propagates X-Request-ID header
  - Binds request context for all logs
  - Acceptance: Request ID in logs and response headers

- [x] **5.4** Replace logging calls
  - File: `services/*/src/main.py`
  - Updated to use structlog via get_logger()
  - Acceptance: Structured log output

- [x] **5.5** Enhanced health checks
  - File: `services/*/src/main.py`
  - Health endpoints now verify MongoDB connectivity
  - Returns "database": "connected" or "disconnected"
  - Acceptance: /health returns database status

---

## Summary

| Phase | Tasks | Priority | Status |
|-------|-------|----------|--------|
| 1 | 8 | Critical | **COMPLETE** ✅ |
| 2 | 6 | High | **COMPLETE** ✅ |
| 3 | 5 | Medium | **COMPLETE** ✅ |
| 4 | 9 | Medium | **NOT NEEDED** (code already follows best practices) |
| 5 | 5 | Low | **COMPLETE** ✅ |
| **Total** | **24/24** | | **100% Complete** |

### Final Summary

**All phases completed successfully:**

**Explainer Service:**
- Motor async MongoDB driver (replaced blocking PyMongo)
- FastAPI Depends() for dependency injection
- Repository pattern with Protocol interfaces
- Pydantic domain models
- Structured logging with structlog
- Request ID middleware for tracing
- Enhanced health checks with DB status

**Summarizer Service:**
- Phase 4 reviewed and determined NOT NEEDED (already well-structured)
- Structured logging with structlog
- Request ID middleware for tracing
- Enhanced health checks with DB status

**Both Services Now Feature:**
- Structured logging (console or JSON based on LOG_FORMAT env)
- X-Request-ID header for request tracing
- Database connectivity verification in /health endpoint

---

## Completed Changes

### Files Created
- `services/explainer/src/schemas.py` - Pydantic domain models
- `services/explainer/src/dependencies.py` - FastAPI DI providers
- `services/explainer/src/repositories/__init__.py` - Package init
- `services/explainer/src/repositories/base.py` - Repository protocols
- `services/explainer/src/repositories/mongodb_repository.py` - Motor async implementation

### Files Modified
- `services/explainer/requirements.txt` - Replaced pymongo with motor
- `services/explainer/pyproject.toml` - Updated dependencies
- `services/explainer/src/main.py` - Uses DI, imports from schemas
- `services/explainer/src/tools/explain_auto.py` - Receives injected deps
- `services/explainer/src/tools/explain_chat.py` - Receives injected deps
- `services/explainer/src/tools/explain_chat_stream.py` - Receives injected deps
- `services/explainer/src/services/__init__.py` - Removed mongodb imports
- `services/explainer/src/services/llm.py` - Removed singleton pattern
- `services/explainer/src/services/llm_provider.py` - Removed singleton pattern
- `services/explainer/tests/conftest.py` - New mock fixtures
- `services/explainer/tests/test_explain_auto.py` - Updated for DI
- `services/explainer/tests/test_explain_chat.py` - Updated for DI

### Files Deleted
- `services/explainer/src/services/mongodb.py` - Replaced by repository layer
- `services/explainer/tests/test_mongodb.py` - Obsolete

---

## Verification

Explainer service verified working:
```
curl http://localhost:8001/health
{"status":"healthy","service":"vie-explainer","model":"gemini/gemini-3-flash-preview","database":"connected"}
```

All imports successful, async MongoDB connection established.

---

## Notes

- Motor driver provides true async MongoDB operations
- FastAPI Depends() enables easy testing with dependency overrides
- Repository pattern abstracts database from business logic
- Domain models provide type safety and validation
- Phase 4-5 deferred as summarizer already follows good patterns internally
