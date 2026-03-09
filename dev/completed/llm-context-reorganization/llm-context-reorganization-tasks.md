# LLM Context Reorganization - Task Checklist

**Last Updated:** 2026-01-21

---

## Phase 1: Create Prompt Files

### 1.1 Create Persona Guideline Files
- [x] Create `prompts/personas/` directory
- [x] Create `prompts/personas/code.txt` with code persona guidelines
- [x] Create `prompts/personas/recipe.txt` with recipe persona guidelines
- [x] Create `prompts/personas/interview.txt` with interview persona guidelines
- [x] Create `prompts/personas/review.txt` with review persona guidelines
- [x] Create `prompts/personas/standard.txt` with standard persona guidelines

### 1.2 Create Example Files
- [x] Create `prompts/examples/` directory
- [x] Create `prompts/examples/code.txt` with code JSON examples
- [x] Create `prompts/examples/recipe.txt` with recipe JSON examples
- [x] Create `prompts/examples/interview.txt` with interview JSON examples
- [x] Create `prompts/examples/review.txt` with review JSON examples
- [x] Create `prompts/examples/standard.txt` with standard JSON examples

### 1.3 Create Detection Rules File
- [x] Create `prompts/detection/` directory
- [x] Create `prompts/detection/persona_rules.json` with keywords and categories

---

## Phase 2: Update llm.py

### 2.1 Add New Loader Functions
- [x] Add `PERSONAS_DIR` path constant
- [x] Add `EXAMPLES_DIR` path constant
- [x] Add `VALID_PERSONAS` frozenset for whitelist validation
- [x] Add `load_persona(name: str) -> str` function with fallback
- [x] Add `load_examples(name: str) -> str` function with fallback
- [x] Add `@lru_cache(maxsize=8)` to both loader functions

### 2.2 Update Existing Functions
- [x] Update `summarize_section()` to use `load_persona()` and `load_examples()`
- [x] Update `stream_summarize_section()` to use `load_persona()` and `load_examples()`

### 2.3 Remove Hardcoded Data
- [x] Remove `PERSONA_GUIDELINES` dictionary
- [x] Remove `VARIANT_EXAMPLES` dictionary

### 2.4 Security Fixes (Code Review Session)
- [x] Add path traversal prevention with `VALID_PERSONAS` whitelist
- [x] Add warning logging for invalid persona names
- [x] Add fallback to 'standard' for unknown personas

### 2.5 Verify
- [x] Run `python -m py_compile services/summarizer/src/services/llm.py`

---

## Phase 3: Update youtube.py

### 3.1 Add Loader Function
- [x] Add `import json` (if not present)
- [x] Add `_load_persona_rules() -> PersonaRules` function with TypedDict
- [x] Add `@lru_cache(maxsize=1)` for caching

### 3.2 Type Safety Improvements (Code Review Session)
- [x] Add `PersonaConfig` TypedDict class
- [x] Add `PersonaRules` TypedDict class
- [x] Proper return type hint on `_load_persona_rules()`

### 3.3 Update Detection Function
- [x] Update `_determine_persona()` to load from JSON
- [x] Replace hardcoded set comparisons with JSON data

### 3.4 Add Missing Personas to persona_rules.json
- [x] Add `interview` persona with keywords and categories
- [x] Add `review` persona with keywords and categories

### 3.5 Remove Hardcoded Data
- [x] Remove `CODE_KEYWORDS` set
- [x] Remove `FOOD_KEYWORDS` set
- [x] Remove `TECH_CATEGORIES` set
- [x] Remove `FOOD_CATEGORIES` set

### 3.6 Verify
- [x] Run `python -m py_compile services/summarizer/src/services/youtube.py`

---

## Phase 4: Testing & Verification

### 4.1 Run Existing Tests
- [x] Run `cd services/summarizer && pytest` - all tests should pass
- [x] Fix any test failures

### 4.2 Add New Tests (Optional but Recommended)
- [x] Add test for `load_persona()` with valid persona
- [x] Add test for `load_persona()` with invalid persona (fallback)
- [x] Add test for `load_examples()` with valid persona
- [x] Add test for `load_examples()` with invalid persona (fallback)
- [x] Add test for `_load_persona_rules()` structure

### 4.3 Manual Verification
- [x] Start summarizer service: `docker-compose up vie-summarizer`
- [x] Process a code-related video → verify "code" persona in logs
- [x] Process a cooking video → verify "recipe" persona in logs
- [x] Process a generic video → verify "standard" persona in logs
- [x] Verify SSE streaming works correctly

---

## Phase 5: Code Review Fixes (2026-01-21 Session)

### 5.1 Frontend Critical Fixes
- [x] Fix StickyChapterNav.tsx - ref update during render (move to useEffect)
- [x] Verify Layout.tsx - handleMouseUp not stale (was already correct)

### 5.2 Frontend High Priority Fixes
- [x] Add useMemo to ComparisonRenderer.tsx variantConfig
- [x] Add ErrorBoundary for lazy-loaded routes in App.tsx
- [x] Add ChunkLoadError fallback component

### 5.3 Frontend Medium Priority Fixes
- [x] Add ARIA live region to RouteLoadingFallback in App.tsx
- [x] Remove hardcoded localhost URLs in index.html
- [x] Add tag sanitization to VideoTags.tsx (sanitizeTag function)
- [x] Fix unsafe type assertion in sse-validators.ts (line 280)
- [x] Add isMountedRef to use-summary-stream.ts for unmount safety
- [x] Remove ineffective startTransition from auth-store.ts

### 5.4 Frontend Low Priority Fixes
- [x] Add null check to main.tsx root element

### 5.5 TypeScript Verification
- [x] Run `pnpm exec tsc --noEmit` - passes with no errors

---

## Completion Criteria

- [x] All Python syntax checks pass
- [x] All existing tests pass
- [x] No hardcoded LLM context remains in Python files
- [x] Prompts folder has clear organization
- [x] Manual verification confirms persona detection works
- [x] Streaming functionality unaffected
- [x] Security audit passed (path traversal prevention)
- [x] Code review passed (0 critical, 0 high issues)

---

## Notes

- Path traversal vulnerability was identified and fixed with whitelist validation
- TypedDict added for better type safety in Python
- @lru_cache added to prevent repeated disk reads
- All frontend block renderers now have memo() for performance
- ErrorBoundary catches lazy loading failures gracefully

---

## Progress Log

| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| 2026-01-20 | Planning | Complete | Created plan, context, and tasks docs |
| 2026-01-20 | Phase 1 | Complete | Created 5 personas, 5 examples, persona_rules.json |
| 2026-01-20 | Phase 2 | Complete | Updated llm.py with load_persona(), load_examples() |
| 2026-01-20 | Phase 3 | Complete | Updated youtube.py with _load_persona_rules() |
| 2026-01-20 | Phase 4 | Complete | All tests pass, Playwright E2E verified |
| 2026-01-21 | Phase 5 | Complete | Code review fixes - all issues resolved |
| 2026-01-21 | Final Review | Complete | Security auditor verified all fixes |
| 2026-01-21 | Phase 4.2 | Complete | Added 15 tests for loader functions (all passing) |
