# Dev Tool for Model Selection - Implementation Plan

**Last Updated:** 2025-01-25
**Status:** Ready for Implementation
**Estimated Effort:** S (Small) - 2-3 hours

---

## Executive Summary

Add a dev-only UI panel to select LLM provider (anthropic/openai/gemini) for re-summarizing videos. This enables A/B testing of LLM providers during development without code changes.

**Scope:** Summarizer only (not explainer)

---

## Current State Analysis

### Existing Infrastructure

1. **LLMProvider** (`services/summarizer/src/services/llm_provider.py:45-313`):
   - Already supports dynamic model configuration via constructor
   - Accepts `model`, `fallback_models`, `timeout`, `num_retries`
   - Uses LiteLLM for multi-provider support

2. **Model Configuration** (`services/summarizer/src/config.py:7-26`):
   - `MODEL_MAP` defines models per provider: anthropic, openai, gemini
   - Each has `default` and `fast` tiers
   - Ready to use - no changes needed

3. **Dependency Injection** (`services/summarizer/src/dependencies.py:37-40`):
   - `get_llm_provider()` is cached (`@lru_cache`)
   - Returns singleton - needs factory pattern for dynamic override

4. **API Routes** (`api/src/routes/videos.routes.ts:6-10`):
   - `createVideoSchema` accepts `url`, `folderId`, `bypassCache`
   - Just add optional `providers` field

5. **Video Service** (`api/src/services/video.service.ts:18-285`):
   - `createVideo()` calls `triggerSummarization()` with request data
   - Just pass `providers` through

6. **Summarizer Client** (`api/src/services/summarizer-client.ts:37-79`):
   - `triggerSummarization()` sends POST to `/summarize`
   - Just add `providers` to request body

7. **Frontend Components**:
   - `SortDropdown.tsx` is a clean pattern to follow for ProviderSelector
   - `Sidebar.tsx` is where DevToolPanel will be rendered

---

## Proposed Future State

### Data Flow

```
DevToolPanel               vie-api                vie-summarizer
     │                        │                         │
     │ POST /api/videos       │                         │
     │ { url, providers }     │                         │
     │───────────────────────>│                         │
     │                        │ POST /summarize         │
     │                        │ { ..., providers }      │
     │                        │────────────────────────>│
     │                        │                         │
     │                        │      LLMProvider(       │
     │                        │        model=X,         │
     │                        │        fallback=Y       │
     │                        │      )                  │
```

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| No new routes | Extend existing | Less code, simpler testing |
| Dev-only panel | `import.meta.env.DEV` | Zero production footprint |
| Request-scoped provider | Factory function | Clean override without global state |

---

## Implementation Phases

### Phase 1: Frontend Components (3 files)

**Goal:** Create dev-only UI for provider selection

| # | File | Action | Effort |
|---|------|--------|--------|
| 1.1 | `apps/web/src/components/dev/ProviderSelector.tsx` | Create | S |
| 1.2 | `apps/web/src/components/dev/DevToolPanel.tsx` | Create | S |
| 1.3 | `apps/web/src/components/sidebar/Sidebar.tsx` | Modify | XS |

### Phase 2: API Pass-Through (3 files)

**Goal:** Add `providers` field throughout the API chain

| # | File | Action | Effort |
|---|------|--------|--------|
| 2.1 | `api/src/routes/videos.routes.ts` | Modify | XS |
| 2.2 | `api/src/services/video.service.ts` | Modify | XS |
| 2.3 | `api/src/services/summarizer-client.ts` | Modify | XS |

### Phase 3: Summarizer Provider Override (3 files)

**Goal:** Accept and apply provider override in summarizer

| # | File | Action | Effort |
|---|------|--------|--------|
| 3.1 | `services/summarizer/src/models/schemas.py` | Modify | XS |
| 3.2 | `services/summarizer/src/dependencies.py` | Modify | S |
| 3.3 | `services/summarizer/src/routes/stream.py` | Modify | S |

---

## Detailed Task Specifications

### Task 1.1: Create ProviderSelector Component

**File:** `apps/web/src/components/dev/ProviderSelector.tsx`

**Acceptance Criteria:**
- [ ] Dropdown with 4 options: (default), anthropic, openai, gemini
- [ ] Props: `value`, `onChange`, `label`, `allowDefault`
- [ ] Follow `SortDropdown.tsx` pattern for UI consistency
- [ ] Use shadcn `DropdownMenu` components

**Implementation:**
```typescript
interface ProviderSelectorProps {
  value: Provider | null;
  onChange: (value: Provider | null) => void;
  label: string;
  allowDefault?: boolean;
}

type Provider = 'anthropic' | 'openai' | 'gemini';
```

### Task 1.2: Create DevToolPanel Component

**File:** `apps/web/src/components/dev/DevToolPanel.tsx`

**Acceptance Criteria:**
- [ ] Only render when `import.meta.env.DEV === true`
- [ ] Collapsible panel with dev indicator
- [ ] Video URL input (reuse existing pattern)
- [ ] 3 ProviderSelector dropdowns: default, fast, fallback
- [ ] Re-summarize button triggers POST /api/videos with providers
- [ ] Show loading state during summarization

**Implementation Notes:**
- Use `useVideos` hook for video list
- Use `useAddVideo` mutation with providers param
- Styled distinctly as dev tool (border, badge)

### Task 1.3: Add DevToolPanel to Sidebar

**File:** `apps/web/src/components/sidebar/Sidebar.tsx`

**Acceptance Criteria:**
- [ ] Import DevToolPanel (dynamic or conditional)
- [ ] Render at bottom of sidebar
- [ ] Only visible in dev mode

### Task 2.1: Add providers to createVideoSchema

**File:** `api/src/routes/videos.routes.ts`

**Acceptance Criteria:**
- [ ] Add optional `providers` field to schema
- [ ] Pass providers to videoService.createVideo()

**Schema Addition:**
```typescript
providers: z.object({
  default: z.enum(['anthropic', 'openai', 'gemini']),
  fast: z.enum(['anthropic', 'openai', 'gemini']).optional(),
  fallback: z.enum(['anthropic', 'openai', 'gemini']).nullable().optional()
}).optional()
```

### Task 2.2: Pass providers through VideoService

**File:** `api/src/services/video.service.ts`

**Acceptance Criteria:**
- [ ] Add `providers` param to `createVideo()`
- [ ] Pass to `triggerSummarization()` calls

### Task 2.3: Include providers in summarizer request

**File:** `api/src/services/summarizer-client.ts`

**Acceptance Criteria:**
- [ ] Add `providers` to `SummarizeRequest` interface
- [ ] Include in POST body

### Task 3.1: Add ProviderConfig schema

**File:** `services/summarizer/src/models/schemas.py`

**Acceptance Criteria:**
- [ ] Create `ProviderConfig` Pydantic model
- [ ] Add `providers` field to `SummarizeRequest`

**Schema:**
```python
class ProviderConfig(BaseModel):
    default: str  # 'anthropic' | 'openai' | 'gemini'
    fast: str | None = None
    fallback: str | None = None

class SummarizeRequest(BaseModel):
    # ... existing fields ...
    providers: ProviderConfig | None = None
```

### Task 3.2: Create LLMProvider factory with override

**File:** `services/summarizer/src/dependencies.py`

**Acceptance Criteria:**
- [ ] Create `create_llm_provider(providers: ProviderConfig | None)` function
- [ ] If providers given, create custom LLMProvider
- [ ] Otherwise, return cached default
- [ ] Use MODEL_MAP to resolve provider names to model strings

**Implementation:**
```python
from src.config import MODEL_MAP

def create_llm_provider(providers: ProviderConfig | None = None) -> LLMProvider:
    if providers:
        model = MODEL_MAP[providers.default]["default"]
        fallback = None
        if providers.fallback:
            fallback = [MODEL_MAP[providers.fallback]["default"]]
        return LLMProvider(model=model, fallback_models=fallback)
    return get_llm_provider()  # Cached default
```

### Task 3.3: Use provider override in stream route

**File:** `services/summarizer/src/routes/stream.py`

**Acceptance Criteria:**
- [ ] Accept providers from request via `/summarize` endpoint
- [ ] Pass to stream_summarization (or create provider in route)
- [ ] LLMService uses custom provider if specified

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dev panel leaks to prod | Low | Medium | `import.meta.env.DEV` check + tree-shaking |
| Invalid provider crashes | Low | Low | Zod validation + try/catch |
| API key missing for provider | Medium | Low | LLMProvider handles with error message |

---

## Success Metrics

1. **Dev mode check:** DevToolPanel visible only when `npm run dev`
2. **Production build:** `npm run build` excludes dev components (verify bundle)
3. **E2E test:** Re-summarize with OpenAI, check logs for `openai/gpt-4o`
4. **Fallback test:** Set fallback provider, verify in summarizer logs

---

## Dependencies

- All LLM API keys configured in `.env`
- LiteLLM properly routing to each provider
- Summarizer service running

---

## Not Included (Deferred)

- ❌ Explainer service provider override
- ❌ Persistent provider preferences
- ❌ Provider-specific cost display
- ❌ A/B comparison UI for summaries
