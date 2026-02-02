# Backend Python Services Refactor

Comprehensive refactoring of `services/summarizer/` and `services/explainer/` to align with backend-python skill best practices.

**Last Updated**: 2026-02-01

---

## Executive Summary

Both Python services are **production-functional** but deviate from best practices in several areas. This refactor improves testability, maintainability, and architectural consistency without changing external behavior.

| Metric | Current | Target |
|--------|---------|--------|
| Summarizer stream.py | 928 lines | ~300 lines |
| Explainer async support | PyMongo (blocking) | Motor (async) |
| Dependency Injection | Partial | FastAPI Depends() |
| Test Coverage | Unknown | 80%+ |

**Effort Estimate**: Large (L) - 4-6 developer-days

---

## Current State Analysis

### Summarizer Service

**Strengths**:
- Excellent async patterns (`asyncio.gather`, `to_thread`, timeouts)
- Protocol-based repository pattern
- Good LiteLLM integration with proper error handling
- Type hints throughout

**Issues**:
1. `routes/stream.py` (928 lines) - violates max 500 line guideline
2. Business logic mixed in route file (pipeline orchestration, transcript fetching)
3. `@lru_cache()` singletons hard to mock

### Explainer Service

**Strengths**:
- Clean file organization (all files <200 lines)
- Good separation between routes and tools
- Proper exception hierarchy

**Issues**:
1. **Blocking MongoDB** - PyMongo in async context (critical)
2. Global singletons instead of FastAPI DI
3. No repository pattern - raw MongoDB functions
4. Schemas embedded in main.py

---

## Proposed Future State

### Architecture After Refactor

```
services/summarizer/src/
├── main.py                    # App factory, middleware, health
├── dependencies.py            # FastAPI Depends() providers
├── config.py                  # Settings via Pydantic
├── exceptions.py              # Domain exceptions
├── routes/
│   └── stream.py              # ~150 lines - HTTP concerns only
├── services/
│   ├── pipeline.py            # NEW: Pipeline orchestration
│   ├── summarizer_service.py  # LLM summarization
│   └── ...
├── repositories/
│   ├── base.py                # Repository protocols
│   └── mongodb_repository.py  # Implementation
└── models/
    └── schemas.py             # Pydantic models
```

```
services/explainer/src/
├── main.py                    # App factory, routes
├── dependencies.py            # NEW: FastAPI Depends()
├── config.py                  # Settings
├── exceptions.py              # Domain exceptions
├── schemas.py                 # NEW: Pydantic models
├── tools/
│   ├── explain_auto.py        # Business logic
│   ├── explain_chat.py
│   └── explain_chat_stream.py
├── services/
│   └── llm.py                 # LLM service
└── repositories/              # NEW
    ├── base.py                # Repository protocols
    └── mongodb_repository.py  # Motor async implementation
```

---

## Implementation Phases

### Phase 1: Explainer Async MongoDB (Priority: Critical)

**Goal**: Replace blocking PyMongo with Motor async driver

**Why First**: Blocking I/O in async context is an anti-pattern that can cause request timeouts and thread starvation.

**Tasks**:
1. Add Motor dependency to requirements.txt
2. Create async MongoDB client factory
3. Convert all database functions to async
4. Update tools to await repository calls
5. Update tests

**Acceptance Criteria**:
- [ ] No blocking PyMongo calls remain
- [ ] All DB operations use `await`
- [ ] Connection pooling configured
- [ ] Health check verifies DB connectivity

**Effort**: Medium (M)

---

### Phase 2: Explainer Dependency Injection

**Goal**: Replace global singletons with FastAPI Depends()

**Tasks**:
1. Create `dependencies.py` with provider functions
2. Add `Annotated[]` type aliases
3. Refactor `main.py` routes to use `Depends()`
4. Refactor tools to receive dependencies
5. Remove global singleton functions

**Acceptance Criteria**:
- [ ] No global `get_*()` singleton calls
- [ ] All dependencies injected via Depends()
- [ ] Dependencies mockable for testing
- [ ] No `@lru_cache()` on singletons

**Effort**: Small (S)

---

### Phase 3: Explainer Repository Pattern

**Goal**: Abstract database access behind repository layer

**Tasks**:
1. Create `repositories/base.py` with Protocol classes
2. Create `VideoSummaryRepository` class
3. Create `ChatHistoryRepository` class
4. Update tools to use repositories
5. Move schemas from main.py to schemas.py

**Acceptance Criteria**:
- [ ] Repository returns domain objects, not raw docs
- [ ] No direct MongoDB access in tools
- [ ] Schemas in dedicated file
- [ ] Protocol allows alternative implementations

**Effort**: Medium (M)

---

### Phase 4: Summarizer Stream Refactor

**Goal**: Extract business logic from routes/stream.py (928 → ~300 lines)

**Tasks**:
1. Create `services/pipeline.py` for orchestration
2. Extract `SummarizationPipeline` class
3. Move transcript fetching logic to service
4. Move context extraction logic to service
5. Keep only HTTP concerns in route file

**Acceptance Criteria**:
- [ ] `routes/stream.py` < 400 lines
- [ ] Route only: parse request, call service, format response
- [ ] Pipeline service handles orchestration
- [ ] No business logic in route handlers

**Effort**: Medium (M)

---

### Phase 5: Cross-Cutting Improvements

**Goal**: Add structured logging and request tracing

**Tasks**:
1. Add structlog dependency to both services
2. Create logging middleware with request ID
3. Replace basic logging with structured logging
4. Add database connectivity to health checks

**Acceptance Criteria**:
- [ ] Request ID in all log entries
- [ ] Structured JSON logging
- [ ] Health endpoints check DB connectivity
- [ ] Log context bound per-request

**Effort**: Small (S)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Motor migration breaks queries | Medium | High | Run integration tests, test with real DB |
| Stream.py refactor breaks SSE | Medium | High | Keep streaming tests, incremental extraction |
| DI refactor causes runtime errors | Low | Medium | Type checking, test all routes |
| Performance regression | Low | Medium | Benchmark before/after |

---

## Success Metrics

1. **Code Quality**
   - stream.py < 400 lines
   - All files < 500 lines
   - No blocking I/O in async context

2. **Testability**
   - All dependencies mockable
   - No global state
   - 80%+ test coverage

3. **Runtime**
   - No performance regression
   - All existing functionality preserved
   - Health checks include DB

---

## Dependencies & Prerequisites

**Required**:
- Motor async MongoDB driver
- structlog (optional, Phase 5)

**Python Packages**:
```
# requirements.txt additions
motor>=3.3.0
structlog>=24.0.0  # optional
```

**No External Dependencies**: This refactor is internal, no API changes.

---

## Testing Strategy

### Per-Phase Testing

1. **Phase 1 (Motor)**: Integration tests with test MongoDB
2. **Phase 2 (DI)**: Unit tests with mocked dependencies
3. **Phase 3 (Repository)**: Repository unit tests
4. **Phase 4 (Stream)**: SSE stream integration tests
5. **Phase 5 (Logging)**: Log output verification

### Verification Commands

```bash
# Run service tests
cd services/summarizer && pytest -v
cd services/explainer && pytest -v

# Health checks
curl http://localhost:8000/health
curl http://localhost:8001/health

# Integration test
curl -X POST http://localhost:8000/summarize -d '{"url": "test"}'
```

---

## Files to Create

| Phase | File | Purpose |
|-------|------|---------|
| 1 | explainer/src/repositories/__init__.py | Package init |
| 1 | explainer/src/repositories/mongodb_repository.py | Motor async repo |
| 2 | explainer/src/dependencies.py | DI providers |
| 3 | explainer/src/repositories/base.py | Protocols |
| 3 | explainer/src/schemas.py | Pydantic models |
| 4 | summarizer/src/services/pipeline.py | Pipeline service |

---

## Files to Modify

| Phase | File | Changes |
|-------|------|---------|
| 1 | explainer/src/services/mongodb.py | Convert to Motor async |
| 1 | explainer/requirements.txt | Add motor |
| 2 | explainer/src/main.py | Add Depends() |
| 2 | explainer/src/tools/*.py | Receive injected deps |
| 3 | explainer/src/main.py | Move schemas out |
| 4 | summarizer/src/routes/stream.py | Extract to service |

---

## Recommended Order

1. **Start with Phase 1** - Critical async fix
2. **Phase 2 + 3 together** - DI and Repository are related
3. **Phase 4** - Independent, can be done in parallel
4. **Phase 5** - Nice to have, lowest priority

---

## Summary

This refactor addresses architectural debt while preserving all external functionality. The most critical fix is replacing blocking PyMongo with Motor in the explainer service. The summarizer refactor improves maintainability but isn't as urgent.

**Total Effort**: 4-6 developer-days
**Priority Order**: Phase 1 → 2+3 → 4 → 5
