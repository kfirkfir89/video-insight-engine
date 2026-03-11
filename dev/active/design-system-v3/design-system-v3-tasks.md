# VIE Design System v3.2 — Tasks

Last Updated: 2026-03-09

---

## Prerequisites

- [x] **P0: Complete `output-quality-fix`** — Fix tab ID alignment in 9/10 output types
- [x] **P1: Complete `pipeline-cleanup`** — Remove ~2,355 dead lines, restructure services/

---

## Phase 1: Blocks + Context (Foundation) ✅

> Ship each independently. No pipeline changes. No breaking changes.
> Phase 1 and Phase 2 can run in parallel.

### 1.1 SpotCard Component [M] ✅
### 1.2 ScoreRing Component [M] ✅
### 1.3 FlashCard Component [M] ✅
### 1.4 CrossTabLink Component [S] ✅
### 1.5 Celebration Component [M] ✅
### 1.6 ScenarioCard Component [M] ✅
### 1.7 TabCoordinationContext [S] ✅
### 1.8 Wire Celebrations to Existing Blocks [S] ✅
### 1.9 Section Accent CSS Variables [S] ✅
### 1.10 LINK_RULES Table + Resolver [S] ✅

---

## Phase 2: Extraction Quality (Prompt Architecture) ✅

> Better prompts, better output. No frontend architecture changes.

### 2.1 Base Extraction Template [L] ✅
### 2.2 Domain Schema Files (Priority 4) [L] ✅
### 2.3 Domain Schema Files (Remaining 4) [L] ✅
### 2.4 Modifier Schema Files [M] ✅
### 2.5 Schema Injection System [M] ✅
### 2.6 Triage Prompt [L] ✅
### 2.7 Triage Pipeline Stage [M] ✅
### 2.8 Post-Processing Rules [M] ✅
### 2.9 Cross-Tab Link Resolver (Python) [S] ✅ (frontend-only resolution)
### 2.10 Enrichment Stage Update [M] ✅

---

## Phase 3: Response Shape Migration (Feature Flag) ✅

> Behind feature flag. Build new path fully. Flip when ready. Old path = rollback.

### 3.1 Feature Flag Infrastructure [S] ✅
### 3.2 New TypeScript Types [L] ✅
### 3.3 New Pydantic Models [L] ✅
### 3.4 New Pipeline Path [XL] ✅
### 3.5 Adaptive Transcript Splitting Update [M] ✅ (existing extractor reused)
### 3.6 Composable Tab Renderer [XL] ✅
### 3.7 Domain Renderers (Priority 4) [L] ✅
### 3.8 Domain Renderers (Remaining 4) [L] ✅
### 3.9 SSE Event Updates [M] ✅
### 3.10 Feature Flag Toggle [M] ✅
### 3.11 Test Suite for New Path [L] ✅

---

## Phase 4: Polish ✅

> Visual polish on working system. After Phase 3 is flipped.

### 4.1 Section Selector with Emoji + Accents [M] ✅
### 4.2 Tab Completion Badges [S] ✅ (via TabCoordinationContext.completedTabs)
### 4.3 Narrative Modifier Rendering [M] ✅
### 4.4 NarrativeRenderer [M] ✅

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Prerequisites | 2 | ✅ Complete |
| Phase 1 | 10 | ✅ Complete |
| Phase 2 | 10 | ✅ Complete |
| Phase 3 | 11 | ✅ Complete |
| Phase 4 | 4 | ✅ Complete |
| **Total** | **37** | **✅ All Complete** |

---

## Test Results (2026-03-09)

- **Frontend unit tests:** 1182 passed (64 test files) ✅
- **Playwright e2e tests:** 19/19 passed (output-layout.spec.ts) ✅
- **TypeScript build:** Clean (no errors) ✅
- **Python tests:** Cannot run locally (Docker deps like yt_dlp) — works in container
