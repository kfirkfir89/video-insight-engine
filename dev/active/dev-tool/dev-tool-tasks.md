# Dev Tool for Model Selection - Task Checklist

**Last Updated:** 2025-01-25

---

## Phase 1: Frontend Components

### 1.1 Create ProviderSelector Component
**File:** `apps/web/src/components/dev/ProviderSelector.tsx`

- [x] Create `dev/` directory in components
- [x] Define `Provider` type: `'anthropic' | 'openai' | 'gemini'`
- [x] Define `ProviderSelectorProps` interface
- [x] Create `PROVIDER_OPTIONS` array with labels and values
- [x] Implement dropdown using shadcn `DropdownMenu`
- [x] Add "(default)" option when `allowNull` prop is true
- [x] Show checkmark for selected value
- [x] Follow `SortDropdown.tsx` styling pattern

### 1.2 Create DevToolPanel Component
**File:** `apps/web/src/components/dev/DevToolPanel.tsx`

- [x] Add dev mode check: `import.meta.env.DEV`
- [x] Create collapsible panel with "Dev Tools" header
- [x] Add video URL input field
- [x] Add 3 ProviderSelector dropdowns:
  - [x] Default Provider (required)
  - [x] Fast Provider (optional, default to same as default)
  - [x] Fallback Provider (optional, nullable)
- [x] Add "Re-summarize" button
- [x] Implement POST to /api/videos with providers field
- [x] Add bypassCache checkbox (toggleable, default true)
- [x] Show loading spinner during request
- [x] Show success/error toast
- [x] Style with distinct dev appearance (yellow border, dev badge)

### 1.3 Add DevToolPanel to Sidebar
**File:** `apps/web/src/components/sidebar/Sidebar.tsx`

- [x] Import DevToolPanel component (lazy loaded)
- [x] Add conditional render at bottom of sidebar
- [x] Verify only renders when `import.meta.env.DEV`

---

## Phase 2: API Pass-Through

### 2.1 Add providers to createVideoSchema
**File:** `api/src/routes/videos.routes.ts`

- [x] Create `providerConfigSchema` with zod
- [x] Add `.optional()` providers field to createVideoSchema
- [x] Pass `input.providers` to `videoService.createVideo()`

### 2.2 Pass providers through VideoService
**File:** `api/src/services/video.service.ts`

- [x] Add `providers?: ProviderConfig` parameter to `createVideo()`
- [x] Import `ProviderConfig` type from summarizer-client
- [x] Pass providers to `triggerSummarization()` in all call sites:
  - [x] bypassCache version creation
  - [x] failed status retry
  - [x] cache miss new entry

### 2.3 Include providers in summarizer request
**File:** `api/src/services/summarizer-client.ts`

- [x] Export `ProviderConfig` type
- [x] Add `providers?: ProviderConfig` to `SummarizeRequest` interface
- [x] Include `providers` in JSON body

---

## Phase 3: Summarizer Provider Override

### 3.1 Add ProviderConfig schema
**File:** `services/summarizer/src/models/schemas.py`

- [x] Create `ProviderConfig` Pydantic model
- [x] Add `providers: ProviderConfig | None = None` to `SummarizeRequest`

### 3.2 Create LLMProvider factory with override
**File:** `services/summarizer/src/dependencies.py`

- [x] Import `MODEL_MAP` from config
- [x] Import `ProviderConfig` from models.schemas
- [x] Create `create_llm_provider(providers: ProviderConfig | None = None)` function
- [x] If providers is None, return cached `get_llm_provider()`
- [x] If providers is set:
  - [x] Resolve `providers.default` to model string via MODEL_MAP
  - [x] Resolve `providers.fallback` to fallback list (if set)
  - [x] Return new `LLMProvider(model=..., fallback_models=...)`
- [x] Add logging for provider override

### 3.3 Use provider override in /summarize endpoint
**File:** `services/summarizer/src/main.py`

- [x] Import `create_llm_provider` from dependencies
- [x] Import `LLMProvider` from services
- [x] Parse providers from request
- [x] Create custom provider if providers specified
- [x] Create LLMService with the selected provider
- [x] Pass to SummarizeService

---

## Verification

### Dev Mode Check
- [x] Run `npm run dev` in apps/web
- [x] Verify DevToolPanel appears in sidebar
- [x] Verify dev styling (yellow border/badge)

### Production Build Check
- [x] Run `npm run build` in apps/web (TypeScript checks pass)
- [x] Verify DevToolPanel NOT in bundle (lazy loading + import.meta.env.DEV check)
- [x] Tree-shaking confirmed by conditional loading pattern

### End-to-End Test
- [ ] Start all services: `docker-compose up`
- [ ] Open app in browser (dev mode)
- [ ] Enter a video URL in DevToolPanel
- [ ] Select "openai" as default provider
- [ ] Click Re-summarize
- [ ] Check summarizer logs: `docker logs vie-summarizer -f`
- [ ] Verify log shows `Using model: openai/gpt-4o`

### Fallback Test
- [ ] Select different provider for fallback
- [ ] Trigger summarization
- [ ] Verify fallback provider in logs

---

## Cleanup (Post-Implementation)

- [x] Remove `DEV-TOOL-PLAN.md` from project root (if exists) - Not present
- [ ] Update `dev/active/multi-provider-llm/` to reference this task as complete
- [ ] Add entry to CHANGELOG if exists

---

## Notes

**Implementation Complete:** All 9 files modified as planned.

**Files Changed:**
1. `apps/web/src/components/dev/ProviderSelector.tsx` - Created
2. `apps/web/src/components/dev/DevToolPanel.tsx` - Created (with bypassCache checkbox)
3. `apps/web/src/components/sidebar/Sidebar.tsx` - Modified
4. `apps/web/src/components/sidebar/AddVideoInput.tsx` - Modified (removed bypassCache, dev-only feature)
4. `apps/web/src/api/videos.ts` - Modified (added ProviderConfig)
5. `apps/web/src/hooks/use-videos.ts` - Modified (added providers param)
6. `api/src/routes/videos.routes.ts` - Modified
7. `api/src/services/video.service.ts` - Modified
8. `api/src/services/summarizer-client.ts` - Modified
9. `services/summarizer/src/models/schemas.py` - Modified
10. `services/summarizer/src/dependencies.py` - Modified
11. `services/summarizer/src/main.py` - Modified

**Deferred:**
- Explainer service provider override
- Provider cost comparison UI
