# Dev Tool for Model Selection - Simplified Plan

## Goal
Add a dev-only UI panel to select LLM provider (anthropic/openai/gemini) for re-summarizing videos.

**Scope:** Summarizer only (not explainer)

---

## Why This Plan (vs DEV-TOOL-PLAN.md)

| DEV-TOOL-PLAN.md (Original) | This Plan |
|-----------------------------|-----------|
| Creates new `/api/dev/resummarize` route | Extends existing `/videos` route |
| Creates new `/dev/summarize` route | Extends existing `/summarize` route |
| 4 new backend route files | 0 new route files |
| ~15 files changed | 9 files total |

**Key insight:** The LLMProvider already supports dynamic provider selection. Just add optional `providers` field to existing routes.

---

## Data Flow

```
DevToolPanel               API                    Summarizer
     │                      │                         │
     │ POST /videos         │                         │
     │ { url, providers }   │                         │
     │─────────────────────>│                         │
     │                      │ POST /summarize         │
     │                      │ { ..., providers }      │
     │                      │────────────────────────>│
     │                      │                         │
     │                      │          LLMProvider(   │
     │                      │            model=X,     │
     │                      │            fallback=Y   │
     │                      │          )              │
```

---

## Implementation

### Phase 1: Frontend (3 files)

#### 1. Create `apps/web/src/components/dev/ProviderSelector.tsx`
- Dropdown component for provider selection
- Options: anthropic, openai, gemini, (none for fallback)
- Follow `SortDropdown.tsx` pattern

#### 2. Create `apps/web/src/components/dev/DevToolPanel.tsx`
- Only render when `import.meta.env.DEV`
- Collapsible panel
- Video selector (dropdown of user's videos)
- 3 ProviderSelector dropdowns: default, fast, fallback
- Re-summarize button (calls existing API with providers)

#### 3. Modify `apps/web/src/components/sidebar/Sidebar.tsx`
- Conditional import/render of DevToolPanel

### Phase 2: API Pass-Through (3 files)

#### 4. Modify `api/src/routes/videos.routes.ts`
- Add optional `providers` to createVideoSchema:
  ```typescript
  providers: z.object({
    default: z.enum(['anthropic', 'openai', 'gemini']),
    fast: z.enum(['anthropic', 'openai', 'gemini']),
    fallback: z.enum(['anthropic', 'openai', 'gemini']).nullable()
  }).optional()
  ```

#### 5. Modify `api/src/services/video.service.ts`
- Add `providers?: ProviderConfig` param to `createVideo()`
- Pass to `triggerSummarization()`

#### 6. Modify `api/src/services/summarizer-client.ts`
- Add `providers` to request payload in `triggerSummarization()`

### Phase 3: Summarizer Provider Override (3 files)

#### 7. Modify `services/summarizer/src/models/schemas.py`
- Add to SummarizeRequest:
  ```python
  providers: ProviderConfig | None = None

  class ProviderConfig(BaseModel):
      default: str
      fast: str
      fallback: str | None = None
  ```

#### 8. Modify `services/summarizer/src/dependencies.py`
- Add factory function that accepts provider overrides:
  ```python
  def create_llm_provider(providers: ProviderConfig | None = None) -> LLMProvider:
      if providers:
          return LLMProvider(
              model=MODEL_MAP[providers.default]["default"],
              fallback_models=[MODEL_MAP[providers.fallback]["default"]] if providers.fallback else None
          )
      return LLMProvider()  # Use defaults
  ```

#### 9. Modify `services/summarizer/src/main.py` or `routes/stream.py`
- Pass providers from request to dependency factory

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `apps/web/src/components/dev/ProviderSelector.tsx` | Create |
| 2 | `apps/web/src/components/dev/DevToolPanel.tsx` | Create |
| 3 | `apps/web/src/components/sidebar/Sidebar.tsx` | Modify (add import) |
| 4 | `api/src/routes/videos.routes.ts` | Modify (add optional field) |
| 5 | `api/src/services/video.service.ts` | Modify (pass through) |
| 6 | `api/src/services/summarizer-client.ts` | Modify (pass through) |
| 7 | `services/summarizer/src/models/schemas.py` | Modify (add schema) |
| 8 | `services/summarizer/src/dependencies.py` | Modify (add factory) |
| 9 | `services/summarizer/src/main.py` or `routes/stream.py` | Modify (use factory) |

---

## Verification

1. **Dev mode check:** `import.meta.env.DEV` shows DevToolPanel
2. **Production build:** `npm run build` excludes dev components
3. **End-to-end test:**
   - Select a video in DevToolPanel
   - Choose provider (e.g., openai)
   - Click re-summarize
   - Check summarizer logs for `Using model: openai/gpt-4o`
4. **Fallback test:** Set fallback to different provider, verify in logs

---

## What We're NOT Doing (vs original plan)

- ❌ No new `/api/dev/*` routes
- ❌ No new `/dev/*` routes in summarizer
- ❌ No `use-dev-resummarize.ts` hook (use existing video mutation)
- ❌ No `apps/web/src/api/dev.ts` (not needed)
- ❌ No modifications to `AddVideoInput.tsx` (keep bypassCache for now)

---

## Status

- [ ] Phase 1: Frontend components
- [ ] Phase 2: API pass-through
- [ ] Phase 3: Summarizer provider override
- [ ] Verification complete
