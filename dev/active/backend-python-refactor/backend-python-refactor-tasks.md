# Backend Python Refactor - Tasks

Checklist for tracking progress. Mark items with `[x]` when complete.

**Last Updated**: 2026-02-01

---

## Phase 1: Explainer Async MongoDB (Priority: Critical)

Replace blocking PyMongo with Motor async driver.

- [ ] **1.1** Add Motor to requirements.txt
  - File: `services/explainer/requirements.txt`
  - Add: `motor>=3.3.0`
  - Acceptance: `pip install -r requirements.txt` succeeds

- [ ] **1.2** Create async MongoDB client factory
  - File: `services/explainer/src/services/mongodb.py`
  - Create `get_async_client()` returning `AsyncIOMotorClient`
  - Configure connection pooling
  - Acceptance: Client connects to MongoDB

- [ ] **1.3** Create repository base protocol
  - File: `services/explainer/src/repositories/base.py` (NEW)
  - Define `VideoSummaryRepository` Protocol
  - Define `ChatHistoryRepository` Protocol
  - Acceptance: Protocols type-check correctly

- [ ] **1.4** Implement VideoSummaryRepository
  - File: `services/explainer/src/repositories/mongodb_repository.py` (NEW)
  - Convert `get_video_summary()` to async method
  - Convert `get_video_context()` to async method
  - Return domain objects, not raw docs
  - Acceptance: All queries use `await`

- [ ] **1.5** Implement ChatHistoryRepository
  - File: `services/explainer/src/repositories/mongodb_repository.py`
  - Convert `save_chat_message()` to async
  - Convert `get_chat_history()` to async
  - Acceptance: All queries use `await`

- [ ] **1.6** Update tools to use async repositories
  - Files: `tools/explain_auto.py`, `tools/explain_chat.py`, `tools/explain_chat_stream.py`
  - Add `await` to all repository calls
  - Pass repository as parameter (prep for Phase 2)
  - Acceptance: No blocking DB calls

- [ ] **1.7** Add DB health check
  - File: `services/explainer/src/main.py`
  - Health endpoint pings MongoDB
  - Acceptance: `/health` returns DB status

- [ ] **1.8** Remove old PyMongo code
  - File: `services/explainer/src/services/mongodb.py`
  - Remove blocking functions
  - Remove PyMongo import
  - Acceptance: No PyMongo imports remain

---

## Phase 2: Explainer Dependency Injection

Replace global singletons with FastAPI Depends().

- [ ] **2.1** Create dependencies.py
  - File: `services/explainer/src/dependencies.py` (NEW)
  - Add `get_mongo_client()` provider
  - Add `get_video_summary_repo()` provider
  - Add `get_chat_repo()` provider
  - Add `get_llm_service()` provider
  - Acceptance: All providers are async functions

- [ ] **2.2** Create type aliases
  - File: `services/explainer/src/dependencies.py`
  - Add `VideoSummaryRepoDep = Annotated[...]`
  - Add `ChatRepoDep = Annotated[...]`
  - Add `LLMServiceDep = Annotated[...]`
  - Acceptance: Type aliases defined with Annotated

- [ ] **2.3** Refactor routes to use Depends()
  - File: `services/explainer/src/main.py`
  - Add dependencies to route function signatures
  - Remove direct calls to `get_*()` functions
  - Acceptance: All routes use injected dependencies

- [ ] **2.4** Refactor tools to receive dependencies
  - Files: `tools/explain_auto.py`, `tools/explain_chat.py`, `tools/explain_chat_stream.py`
  - Change function signatures to accept repo and llm as params
  - Remove internal calls to global getters
  - Acceptance: Tools are pure functions with injected deps

- [ ] **2.5** Remove singleton functions
  - Files: `services/llm.py`, `services/llm_provider.py`
  - Remove `@lru_cache()` decorators
  - Remove global state
  - Acceptance: No global singletons

- [ ] **2.6** Write DI unit tests
  - File: `tests/test_dependencies.py` (NEW)
  - Test that dependencies can be mocked
  - Test route with mock dependencies
  - Acceptance: Tests pass with mocked deps

---

## Phase 3: Explainer Repository Pattern

Create clean repository abstraction layer.

- [ ] **3.1** Define repository protocols
  - File: `services/explainer/src/repositories/base.py`
  - Define abstract methods for all operations
  - Add return type hints
  - Acceptance: Protocols define complete interface

- [ ] **3.2** Create domain models
  - File: `services/explainer/src/schemas.py` (NEW)
  - Move `ExplainAutoRequest` from main.py
  - Move `ExplainChatRequest` from main.py
  - Add response models
  - Add `VideoSummary` domain model
  - Acceptance: All schemas in dedicated file

- [ ] **3.3** Repository returns domain objects
  - File: `services/explainer/src/repositories/mongodb_repository.py`
  - Add `_to_entity()` methods
  - Return typed domain objects
  - Acceptance: No raw dicts returned

- [ ] **3.4** Update main.py imports
  - File: `services/explainer/src/main.py`
  - Import schemas from schemas.py
  - Remove inline model definitions
  - Acceptance: main.py has no Pydantic models

- [ ] **3.5** Write repository tests
  - File: `tests/test_repositories.py` (NEW)
  - Test CRUD operations
  - Test entity mapping
  - Acceptance: 80%+ repository coverage

---

## Phase 4: Summarizer Stream Refactor

Extract business logic from routes/stream.py.

- [ ] **4.1** Create pipeline service
  - File: `services/summarizer/src/services/pipeline.py` (NEW)
  - Create `SummarizationPipeline` class
  - Define `__init__` with dependencies
  - Define `async execute()` main method
  - Acceptance: Class structure defined

- [ ] **4.2** Extract transcript fetching
  - Source: `routes/stream.py`
  - Target: `services/pipeline.py`
  - Move transcript fetch logic to `_fetch_transcript()`
  - Acceptance: Method in pipeline class

- [ ] **4.3** Extract context extraction
  - Source: `routes/stream.py`
  - Target: `services/pipeline.py`
  - Move context logic to `_extract_context()`
  - Acceptance: Method in pipeline class

- [ ] **4.4** Extract section processing
  - Source: `routes/stream.py`
  - Target: `services/pipeline.py`
  - Move section logic to `_process_sections()`
  - Acceptance: Method in pipeline class

- [ ] **4.5** Extract synthesis streaming
  - Source: `routes/stream.py`
  - Target: `services/pipeline.py`
  - Move synthesis to `_stream_synthesis()`
  - Keep as AsyncGenerator
  - Acceptance: Method yields SSE events

- [ ] **4.6** Refactor route to use pipeline
  - File: `services/summarizer/src/routes/stream.py`
  - Import and instantiate pipeline
  - Route calls `pipeline.execute()`
  - Keep only HTTP concerns
  - Acceptance: Route < 200 lines

- [ ] **4.7** Update dependencies
  - File: `services/summarizer/src/dependencies.py`
  - Add `get_pipeline()` provider
  - Add `PipelineDep` type alias
  - Acceptance: Pipeline injectable

- [ ] **4.8** Verify streaming works
  - Manual test: Submit video URL
  - Verify SSE events stream correctly
  - Verify all sections generated
  - Acceptance: Identical output to before

- [ ] **4.9** Write pipeline tests
  - File: `tests/test_pipeline.py` (NEW)
  - Test each pipeline stage
  - Mock external dependencies
  - Acceptance: 80%+ pipeline coverage

---

## Phase 5: Cross-Cutting Improvements (Optional)

Add structured logging and request tracing.

- [ ] **5.1** Add structlog to requirements
  - Files: `summarizer/requirements.txt`, `explainer/requirements.txt`
  - Add: `structlog>=24.0.0`
  - Acceptance: Package installs

- [ ] **5.2** Configure structlog
  - Files: `summarizer/src/config.py`, `explainer/src/config.py`
  - Add logging configuration
  - Configure JSON output
  - Acceptance: Logs output as JSON

- [ ] **5.3** Create request ID middleware
  - Files: `summarizer/src/main.py`, `explainer/src/main.py`
  - Generate UUID for each request
  - Bind to log context
  - Acceptance: Request ID in all logs

- [ ] **5.4** Replace logging calls
  - All Python files in both services
  - Replace `logging.info()` with `structlog.info()`
  - Add context where appropriate
  - Acceptance: No basic logging calls

- [ ] **5.5** Enhanced health checks
  - Files: `summarizer/src/main.py`, `explainer/src/main.py`
  - Add DB connectivity check
  - Add LLM provider check (optional)
  - Return detailed status
  - Acceptance: Health shows component status

---

## Summary

| Phase | Tasks | Priority | Effort |
|-------|-------|----------|--------|
| 1 | 8 | Critical | M |
| 2 | 6 | High | S |
| 3 | 5 | Medium | M |
| 4 | 9 | Medium | M |
| 5 | 5 | Low | S |
| **Total** | **33** | | **L** |

---

## Quick Start

To resume this task:

1. Check current progress in this file
2. Read context: `dev/active/backend-python-refactor/backend-python-refactor-context.md`
3. Read plan: `dev/active/backend-python-refactor/backend-python-refactor-plan.md`
4. Continue from first unchecked task

---

## Notes

<!-- Add notes during implementation -->
