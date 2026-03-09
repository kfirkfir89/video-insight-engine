# Unified Output System — Tasks

**Last Updated: 2026-03-05 (Session 4 — V2 Cleanup Complete)**

---

## Phase 1: Type System Unification [Effort: M] — ✅ COMPLETE

### output-types.ts Renames
- ✅ 1.1 Rename `OutputTypeV2` -> `OutputType` — DONE
- ✅ 1.2 Rename `smart_summary` value -> `explanation` in OutputType — DONE
- ✅ 1.3 Rename `SmartSummaryOutput` -> `ExplanationOutput` — DONE
- ✅ 1.4 Rename `VideoOutputV2` -> `VideoOutput`, remove `pipelineVersion` field — DONE
- ✅ 1.5 Rename `isOutputTypeV2` -> `isValidOutputType` — DONE
- ✅ 1.6 Delete `PipelineVersion` type — DONE
- ✅ 1.7 Delete `VideoOutputV1` interface — DONE
- ✅ 1.8 Delete `OUTPUT_TYPE_V1_TO_V2` mapping — DONE
- ✅ 1.9 Delete `isV1Output`, `isV2Output` type guards — DONE

### index.ts V1 Removal
- ✅ 1.10-1.17 V1 types removed from index.ts — DONE
- ✅ 1.18 ContentBlock union updated — DONE

### Downstream Fixes
- ✅ 1.19-1.22 All TypeScript errors fixed — DONE

---

## Phase 2: Block Consolidation [Effort: L] — CORE DONE, DEEPER DEFERRED

### ListBlock (BulletsBlock + NumberedBlock)
- ✅ 2.1-2.3 ListBlock created, old files deleted — DONE

### ComparisonBlock (ComparisonRenderer + DosDontsBlock + ProConBlock)
- ✅ 2.5-2.7 do_dont/pro_con routed through ComparisonRenderer in ContentBlockRenderer, old files deleted — DONE
- ✅ 2.8 comparison-consolidation.test.tsx created — DONE

### Deeper Consolidation — DEFERRED (existing blocks work fine)
- [ ] 2.9-2.12 CodeBlock modes (code/example/terminal)
- [ ] 2.13-2.16 CalloutBlock variant (quote)
- [ ] 2.17-2.20 DataListBlock (4 blocks)
- [ ] 2.21-2.24 StepsBlock (step + timeline)

### Verification
- ✅ 2.25-2.27 All output views render, tsc passes, tests pass — VERIFIED

---

## Phase 3: V1 Deletion [Effort: L] — ✅ COMPLETE

- ✅ 3a: V1 Views — 13 files deleted
- ✅ 3b: V1 Layout Components — 22 files deleted
- ✅ 3c: V1 Containers — 5 files deleted
- ✅ 3d: V1 Hooks — 7 files + 2 test files deleted
- ✅ 3e: V1 Libs — auto-flow-layout.ts, content-weight.ts deleted; kept still-referenced libs
- ✅ 3f: VideoHero, VideoTags, ResourcesPanel, VideoChatPanel, GoDeepDrawer, MasterSummaryModal deleted
- ✅ 3.27: use-output-state.ts, use-markdown-export.ts, block-to-markdown.ts — confirmed dead, deleted

---

## Phase 4: Rename V2 -> The System [Effort: M] — ✅ COMPLETE

### 4a: File Moves
- ✅ 4.1 Output components in `output/` directory — DONE
- ✅ 4.3 OutputRouter simplified (no V1 fallback) — DONE
- ✅ 4.10-4.12 VideoDetailPage cleaned — DONE

### 4b-4c: V2 Prefix Cleanup (Session 4)
- ✅ API: `v2Output` → `output` in video.service.ts response — DONE
- ✅ API: `v2Output` → `output` in video.service.test.ts — DONE
- ✅ Web: `data?.v2Output` → `data?.output` in videos.ts + VideoDetailPage.tsx — DONE
- ✅ API: Removed `pipelineVersion: '2.0'` from repository updateIntent() — DONE
- ✅ API: "Pipeline V2" → "Pipeline" in stream.routes.ts comments — DONE
- ✅ Python: `v2_result` → `result`, `_stream_cached_result_v2` → `_stream_cached_structured` in stream.py — DONE
- ✅ Python: `SmartSummaryOutput` → `ExplanationOutput` in output_types.py + tests — DONE
- ✅ Types: All "(V2.1)" annotations removed from index.ts, block-schemas.ts, ContentBlockRenderer.tsx — DONE
- ✅ CSS: "(v2)" comments removed, `--animate-fade-up-v2` → `--animate-fade-up-spring`, `--animate-pulse-v2` → `--animate-pulse-slow` — DONE
- ✅ CSS: "Glass v2" → "Glass" in blocks.css — DONE
- ✅ Python: "V2.1" removed from block_postprocessing.py, cross_chapter_consolidation.py — DONE
- ✅ Barrel files: "(V2.1)" removed from memorized/index.ts, collections/index.ts, rag/index.ts — DONE
- ✅ E2E: `pipeline-v2-layout.spec.ts` → `output-layout.spec.ts`, all v2 variable/function names cleaned — DONE
- ✅ E2E: Critical fix — mock API response key `v2Output` → `output` — DONE

### Verification
- ✅ `tsc --noEmit` passes (API + Web)
- ✅ 1095 web unit tests pass (54 files)
- ✅ 606 API unit tests pass (38 files)
- ✅ 181 Playwright e2e tests pass

---

## Phase 5: ExplanationView [Effort: M] — ✅ COMPLETE

- ✅ 5.2-5.7 ExplanationTabs with 4 interactive sub-components — DONE
- ✅ 5.9 Unit tests (12 tests) — DONE
- ✅ 5.10-5.12 Responsive + dark mode verified — DONE

---

## Phase 6: ChaptersView [Effort: M] — DEFERRED

Additive feature, no blocking dependency. Can be built independently.

---

## Phase 7: Multi-Output Groundwork [Effort: S] — ✅ COMPLETE

- ✅ 7.1 Added `additionalOutputs?: OutputData[]` to VideoOutput type — DONE
- ✅ 7.2-7.3 Existing videos work, no runtime change — VERIFIED

---

## Phase 8: Backend Prompt Consolidation [Effort: M] — ✅ COMPLETE

Backend prompts and Python models updated.

---

## Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1: Types | ✅ 100% | All renames done, V1 types removed |
| 2: Blocks | ~70% | ListBlock + ComparisonRenderer done. Deeper consolidation deferred |
| 3: V1 Delete | ✅ 100% | All V1 code deleted |
| 4: Rename V2 | ✅ 100% | All v2/V2 prefixes eliminated from code, comments, CSS, tests |
| 5: ExplanationView | ✅ 100% | Interactive tabs with expand/checkbox |
| 6: ChaptersView | 0% | DEFERRED (additive) |
| 7: Multi-Output | ✅ 100% | Type groundwork done |
| 8: Backend Prompts | ✅ 100% | Done previously |

**All phases complete except Phase 6 (deferred additive feature) and Phase 2 deeper consolidation (optional).**
