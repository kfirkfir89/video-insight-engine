# Development Scratchpad

**Last Updated:** 2026-01-21 (Session 3)

---

## Session Handoff Notes

### What Was Being Worked On

**Task: Video Context Backend Verification**

**Status: ALL PHASES COMPLETE** - Discovery: Phases 1-3 were already implemented!

### Current State

- **Backend phases 1-3 already implemented** (discovered during code review)
- All context extraction, persona loading, and SSE integration already in place
- Task documentation updated to reflect completion
- **Remaining work:** Verification testing with real videos, optional accessibility fixes

### Phase 4 Types (Already in Code)

| Type | Location | Line Numbers |
|------|----------|--------------|
| `VideoContext` | `packages/types/src/index.ts` | 26-35 |
| `KeyValueBlock` | `packages/types/src/index.ts` | 95-99 |
| `ComparisonBlock` | `packages/types/src/index.ts` | 101-106 |
| `TimestampBlock` | `packages/types/src/index.ts` | 108-113 |
| Variant fields | `packages/types/src/index.ts` | 45-91 |
| `ContentBlock` union | `packages/types/src/index.ts` | 134-146 |
| `VideoResponse.context` | `packages/types/src/index.ts` | 270 |

---

## Previous Session (2026-01-21 - Session 1) - Content Block Improvements

### Files Modified

| File | Changes |
|------|---------|
| `ContentBlocks.tsx` | Added `onStop`, `isVideoActive`, `activeStartSeconds` props |
| `ContentBlockRenderer.tsx` | Thread props to TimestampRenderer, simplified callout |
| `blocks/TimestampRenderer.tsx` | Added stop button state when `isActive` |
| `ArticleSection.tsx` | Pass new props to ContentBlocks |
| `VideoDetailLayout.tsx` | Added `activeStartSeconds` state for correct timestamp playback |

### Key Implementation Details

**Timestamp Stop Button Flow:**
```
VideoDetailLayout (activePlaySection, activeStartSeconds state)
  → ArticleSection (isVideoActive, startSeconds, onStop)
    → ContentBlocks (isVideoActive, activeStartSeconds, onStop)
      → ContentBlockRenderer (calculates isActive)
        → TimestampRenderer (shows play or stop based on isActive)
```

**isActive Calculation:**
```typescript
isActive={isVideoActive && activeStartSeconds === block.seconds}
```

### Commands to Run on Restart

```bash
# Verify TypeScript compiles
cd /home/kfir/projects/video-insight-engine/apps/web
pnpm exec tsc --noEmit

# Test timestamp functionality manually:
# 1. Open a video with timestamp blocks
# 2. Click a timestamp (e.g., "4:12")
# 3. Video should collapse under section at that time
# 4. Timestamp button should show red stop icon
# 5. Clicking stop should collapse video
```

### Optional Improvements (from Code Review)

1. Add focus indicator: `focus-visible:ring-2 focus-visible:ring-primary`
2. Fix aria-label when block.label is empty

---

## Previous Session (2026-01-21) - LLM Context Reorganization

### Key Changes Made

#### Python Backend (services/summarizer)

| File | Changes |
|------|---------|
| `llm.py` | `VALID_PERSONAS` whitelist, `load_persona()`, `load_examples()` with `@lru_cache` |
| `youtube.py` | `PersonaConfig`/`PersonaRules` TypedDict, `_load_persona_rules()` with `@lru_cache` |
| `prompts/personas/*.txt` | 5 persona guideline files |
| `prompts/examples/*.txt` | 5 example files with JSON blocks |
| `prompts/detection/persona_rules.json` | Keywords and categories |

#### Frontend Code Review Fixes

| File | Fix |
|------|-----|
| `StickyChapterNav.tsx` | Moved ref update from render to useEffect |
| `ComparisonRenderer.tsx` | Added `useMemo` for variantConfig |
| `App.tsx` | Added ErrorBoundary, ChunkLoadError, ARIA live region |
| `VideoTags.tsx` | Added `sanitizeTag()` function |
| `sse-validators.ts` | Removed unsafe type assertion |
| `use-summary-stream.ts` | Added `isMountedRef` for unmount safety |
| `auth-store.ts` | Removed ineffective `startTransition` |
| `main.tsx` | Added null check for root element |
| `index.html` | Removed hardcoded localhost URLs |

### Key Patterns Established

1. **Path Traversal Prevention:**
   ```python
   VALID_PERSONAS: frozenset[str] = frozenset(['code', 'recipe', ...])
   if name not in VALID_PERSONAS:
       name = 'standard'
   ```

2. **React Ref Updates:**
   ```typescript
   // WRONG: during render
   sectionsRef.current = sections;

   // RIGHT: in useEffect
   useEffect(() => { sectionsRef.current = sections; }, [sections]);
   ```

3. **Mounted Check Pattern:**
   ```typescript
   const isMountedRef = useRef(true);
   useEffect(() => {
     isMountedRef.current = true;
     return () => { isMountedRef.current = false; };
   }, [deps]);
   ```

---

## Previous Session (2026-01-09) - Integration Testing

### Test Results Summary

| Phase | Test | Result |
|-------|------|--------|
| Phase 2 | Health Checks | 16/16 PASS |
| Phase 3 | Auth Flow | 21/21 PASS |
| Phase 4 | Video Flow | 15/16 PASS (1 skipped) |
| Phase 5 | Explain Flow | 5 SKIPPED (MCP not implemented) |
| Phase 6 | E2E Journey | 10/10 PASS |
| Phase 7 | WebSocket | 6/6 PASS |

---

## Architecture Notes

### Timestamp Playback Architecture (NEW)

```
User clicks timestamp "4:12" (252 seconds)
  → TimestampRenderer calls onPlay(252)
  → ContentBlocks calls onPlay(252)
  → ArticleSection calls onPlay(sectionId, 252)
  → VideoDetailLayout.handlePlayFromSection(sectionId, 252)
    → setActivePlaySection(sectionId)
    → setActiveStartSeconds(252)
    → Scrolls to section
  → ArticleSection re-renders with isVideoActive=true, startSeconds=252
    → YouTubePlayer renders with startSeconds=252, autoplay=true
    → ContentBlocks receives isVideoActive=true, activeStartSeconds=252
      → TimestampRenderer with seconds=252 shows STOP (isActive=true)
      → Other timestamps show PLAY (isActive=false)
```

### Persona System Flow
```
Video URL submitted
  → YouTube metadata extracted (category, tags)
  → _determine_persona() checks against persona_rules.json
  → Returns: 'code', 'recipe', 'interview', 'review', or 'standard'
  → load_persona(name) loads prompts/personas/{name}.txt
  → load_examples(name) loads prompts/examples/{name}.txt
  → LLM generates summary with persona-specific blocks
```

### WebSocket Flow
```
Summarizer completes
  → POST /internal/status
  → API broadcasts to WebSocket
  → Frontend useWebSocket hook receives
  → Invalidates React Query
  → UI updates automatically
```

---

## Quick Reference

### Test Accounts
- Admin: `admin@admin.com` / `Admin123`

### Service URLs
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Summarizer: http://localhost:8000

### Key Files
- Timestamp rendering: `apps/web/src/components/video-detail/blocks/TimestampRenderer.tsx`
- Content blocks container: `apps/web/src/components/video-detail/ContentBlocks.tsx`
- Video layout state: `apps/web/src/components/video-detail/VideoDetailLayout.tsx`
- Persona loading: `services/summarizer/src/services/llm.py`
- Persona detection: `services/summarizer/src/services/youtube.py`
- Persona rules: `services/summarizer/src/prompts/detection/persona_rules.json`
- SSE streaming: `apps/web/src/hooks/use-summary-stream.ts`

---

## Active Task Documentation

### Video Context Enhancement
See `/dev/active/video-context/` for:
- `video-context-context.md` - Full context and decisions
- `video-context-tasks.md` - Task checklist
- `video-context-plan.md` - Original implementation plan

**Status:**
- ✅ Phase 0: Frontend Content Block Fixes
- ✅ Phase 1: Backend - Context Extraction (discovered complete)
- ✅ Phase 2: Backend - Prompt Enhancement (discovered complete)
- ✅ Phase 3: Backend - Stream Integration (discovered complete)
- ✅ Phase 4: Shared Types Update
- ✅ Phase 5: Frontend - New Block Renderers
- ✅ Phase 6: Frontend - Variant Styling
- ✅ Phase 7: Frontend - Tags Display
- ⬜ Phase 8: Optional Specialized Views

**All core phases complete! Need verification testing with real videos.**

### LLM Context Reorganization
See `/dev/active/llm-context-reorganization/` for:
- `llm-context-reorganization-context.md` - Full context and decisions
- `llm-context-reorganization-tasks.md` - Task checklist (all complete)
- `llm-context-reorganization-plan.md` - Original implementation plan

---

## Uncommitted Changes

**Multiple sessions of work - review git status**

Key changes ready to commit:
- Timestamp stop button feature
- Content block alignment fixes
- Simplified callout styling
- Persona system moved from hardcoded to file-based
- Security fixes (path traversal, sanitization)
- Performance fixes (memoization, caching)
- React best practices (ref patterns, ErrorBoundary)
- Accessibility (ARIA attributes)

**Recommendation:** Review with `git status` and `git diff --stat` before committing.
