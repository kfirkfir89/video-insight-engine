# Multi-Provider LLM Integration Plan

**Last Updated:** 2026-01-25

## Executive Summary

Integrate LiteLLM to enable multi-provider LLM support (Anthropic, OpenAI, Google Gemini) across vie-summarizer and vie-explainer services. This provides provider flexibility, automatic fallbacks, unified API, and cost tracking.

**Current State:** Both Python services use Anthropic SDK directly with no abstraction layer.

**Target State:** Both services use LiteLLM abstraction with configurable providers, automatic fallback chains, and MongoDB-based usage tracking.

---

## Goals

1. **Provider Flexibility** - Switch between Anthropic, OpenAI, and Gemini via config
2. **Resilience** - Automatic fallback when primary provider fails
3. **Cost Visibility** - Track all LLM usage and costs in MongoDB
4. **Code Simplification** - Replace threading-based streaming with native async
5. **Future-Ready** - Easy to add new providers as needed

## Non-Goals

- Shared package extraction (future enhancement)
- Redis caching layer (future enhancement)
- A/B testing across providers (future enhancement)
- Frontend provider selection (API-only for now)

---

## Current State Analysis

### vie-summarizer (`services/summarizer/src/services/llm.py`)

| Aspect | Current Implementation |
|--------|----------------------|
| SDK | `anthropic.Anthropic` (sync client) |
| Async | `asyncio.to_thread()` wrapper |
| Streaming | Threading + Queue pattern |
| Config | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Lines | ~830 lines |

**Key Methods:**
- `_call_llm()` - Non-streaming completion
- `stream_llm()` - Threading-based streaming
- `detect_sections()`, `summarize_section()`, `extract_concepts()`, etc.

### vie-explainer (`services/explainer/src/services/llm.py`)

| Aspect | Current Implementation |
|--------|----------------------|
| SDK | `anthropic.Anthropic` (sync client) |
| Async | `asyncio.to_thread()` wrapper |
| Streaming | ThreadPoolExecutor + Queue |
| Config | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Lines | ~220 lines |

**Key Methods:**
- `chat_completion()` - Non-streaming with system prompt
- `chat_completion_stream()` - Streaming with ThreadPoolExecutor
- `generate_expansion()` - Template-based generation

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LLMProvider (New)                        │
├─────────────────────────────────────────────────────────────┤
│  • complete(prompt, options) -> str                         │
│  • complete_with_messages(messages, options) -> str         │
│  • stream(prompt, options) -> AsyncGenerator                │
│  • stream_with_messages(messages, options) -> AsyncGenerator│
├─────────────────────────────────────────────────────────────┤
│                    LiteLLM acompletion()                    │
│  • Model format: "anthropic/claude-sonnet-4-20250514"       │
│  • Built-in: retries, fallbacks, cost tracking              │
├─────────────────────────────────────────────────────────────┤
│                    UsageTracker (New)                       │
│  • LiteLLM callbacks -> MongoDB llm_usage collection        │
│  • success_callback, failure_callback                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Dependencies & Configuration (Day 1)

Update both services with LiteLLM dependency and extended config.

**Files to modify:**
- `services/summarizer/requirements.txt`
- `services/explainer/requirements.txt`
- `services/summarizer/src/config.py`
- `services/explainer/src/config.py`
- `.env.example`

### Phase 2: Create LLMProvider Abstraction (Day 1-2)

Create the LiteLLM wrapper in both services (duplicated for MVP).

**New files:**
- `services/summarizer/src/services/llm_provider.py`
- `services/explainer/src/services/llm_provider.py`

**LLMProvider class features:**
- Unified completion interface
- Native async streaming (no threading)
- Model mapping (provider -> model name)
- Fallback configuration
- Metadata passing for usage tracking

### Phase 3: Create Usage Tracker (Day 2)

Create MongoDB-based usage tracking via LiteLLM callbacks.

**New files:**
- `services/summarizer/src/services/usage_tracker.py`
- `services/explainer/src/services/usage_tracker.py`

**LLMUsageRecord schema:**
```python
user_id: str | None
model: str                 # "anthropic/claude-sonnet-4-20250514"
provider: str              # "anthropic"
tokens_in: int
tokens_out: int
cost_usd: float
feature: str               # "summarize", "expand", "chat"
timestamp: datetime
success: bool
error_message: str | None
duration_ms: int
request_id: str | None
```

### Phase 4: Refactor Summarizer LLM Service (Day 2-3)

Update vie-summarizer to use LLMProvider.

**File to modify:**
- `services/summarizer/src/services/llm.py`
- `services/summarizer/src/dependencies.py`

**Changes:**
- Replace `anthropic.Anthropic` with `LLMProvider`
- Replace `_call_llm()` with `provider.complete()`
- Replace `stream_llm()` with `provider.stream()` (removes threading)
- Add feature/user_id metadata to all calls

### Phase 5: Refactor Explainer LLM Service (Day 3)

Update vie-explainer to use LLMProvider.

**File to modify:**
- `services/explainer/src/services/llm.py`

**Changes:**
- Replace `anthropic.Anthropic` with `LLMProvider`
- Replace `chat_completion()` with `provider.complete_with_messages()`
- Replace `chat_completion_stream()` with `provider.stream_with_messages()`
- Remove ThreadPoolExecutor (no longer needed)
- Add feature/user_id metadata to all calls

### Phase 6: Testing & Verification (Day 4)

Comprehensive testing across providers.

**New test files:**
- `services/summarizer/tests/test_llm_provider.py`
- `services/explainer/tests/test_llm_provider.py`

**Verification:**
1. Unit tests with mocked LiteLLM
2. Integration test with each provider
3. Streaming validation
4. Fallback behavior
5. Usage tracking queries

---

## Detailed Task Breakdown

### 1. Dependencies & Configuration

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 1.1 | Add litellm to summarizer requirements | S | `litellm>=1.80.0` in requirements.txt |
| 1.2 | Add litellm to explainer requirements | S | `litellm>=1.80.0` in requirements.txt |
| 1.3 | Extend summarizer config.py | M | LLM_PROVIDER, fallback, multi-key config |
| 1.4 | Extend explainer config.py | M | LLM_PROVIDER, fallback, multi-key config |
| 1.5 | Update .env.example | S | Document all new env vars |

### 2. LLMProvider Abstraction

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 2.1 | Create summarizer llm_provider.py | L | LLMProvider class with complete/stream methods |
| 2.2 | Create explainer llm_provider.py | L | Same implementation (duplicate) |
| 2.3 | Add model mapping | S | anthropic/openai/gemini model name mapping |
| 2.4 | Configure fallbacks | M | Fallback chain via LiteLLM parameter |

### 3. Usage Tracking

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 3.1 | Create usage_tracker.py (summarizer) | M | success/failure callbacks, MongoDB insert |
| 3.2 | Create usage_tracker.py (explainer) | M | Same implementation (duplicate) |
| 3.3 | Register callbacks in provider | S | Callbacks registered on import |
| 3.4 | Create MongoDB indexes | S | Indexes for user_id, timestamp, feature |

### 4. Refactor Summarizer

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 4.1 | Update LLMService constructor | M | Accept LLMProvider instead of anthropic.Anthropic |
| 4.2 | Refactor _call_llm() | M | Use provider.complete() |
| 4.3 | Refactor stream_llm() | L | Use provider.stream(), remove threading |
| 4.4 | Update dependencies.py | M | New get_llm_provider() factory |
| 4.5 | Add metadata to all calls | M | user_id, feature, request_id |

### 5. Refactor Explainer

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 5.1 | Update LLMService constructor | M | Accept LLMProvider |
| 5.2 | Refactor chat_completion() | M | Use provider.complete_with_messages() |
| 5.3 | Refactor chat_completion_stream() | L | Use provider.stream_with_messages(), remove executor |
| 5.4 | Remove ThreadPoolExecutor | S | Delete executor and atexit handler |
| 5.5 | Add metadata to all calls | M | user_id, feature, request_id |

### 6. Testing

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 6.1 | Unit tests for LLMProvider | L | Mock LiteLLM, test all methods |
| 6.2 | Integration test: Anthropic | M | Real API call, verify response format |
| 6.3 | Integration test: OpenAI | M | Real API call with OpenAI key |
| 6.4 | Integration test: Gemini | M | Real API call with Google key |
| 6.5 | Streaming test | M | Verify SSE works with all providers |
| 6.6 | Fallback test | M | Primary failure triggers fallback |
| 6.7 | Usage tracking test | M | Verify llm_usage collection populated |

---

## Environment Variables

```bash
# Primary provider (default: anthropic)
LLM_PROVIDER=anthropic

# Fallback provider (optional)
LLM_FALLBACK_PROVIDER=openai

# Model overrides (optional)
LLM_MODEL=anthropic/claude-sonnet-4-20250514
LLM_FAST_MODEL=anthropic/claude-3-5-haiku-20241022

# API Keys (set for providers you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LiteLLM API changes | Low | Medium | Pin version, monitor releases |
| Provider pricing changes | Medium | Low | Cost tracking enables quick detection |
| Streaming format differences | Medium | Medium | Test each provider's streaming |
| Thread cleanup issues | Low | Medium | LiteLLM handles this natively |

---

## Rollback Plan

If issues arise:

1. Revert requirements.txt to `anthropic>=0.18.0`
2. `git checkout` the llm.py files
3. Remove llm_provider.py and usage_tracker.py
4. Revert config.py changes

All changes are isolated to 2 services with clear file boundaries.

---

## Success Metrics

1. **Functional:** All existing summarize/explain features work
2. **Provider:** Can switch providers via env var without code changes
3. **Fallback:** Failed primary automatically uses fallback
4. **Tracking:** All LLM calls appear in llm_usage collection
5. **Performance:** Streaming latency equivalent or better (no threading overhead)
6. **Code Quality:** Reduced complexity in streaming code

---

## Dependencies

- LiteLLM >= 1.80.0
- No changes to Node.js API
- No changes to frontend
- No changes to prompt files (already provider-agnostic)

---

## Future Enhancements (Out of Scope)

- Extract to shared package (`packages/llm-provider`)
- Redis caching at provider level
- Per-task model selection (cheap for extraction, premium for synthesis)
- A/B testing across providers
- Usage dashboard visualization
