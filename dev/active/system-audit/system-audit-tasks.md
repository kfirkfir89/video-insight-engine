# VIE System Audit — Task Checklist

Last Updated: 2026-03-10

## Phase 1: Critical Alignment (Backend) — Priority: CRITICAL

### 1.1 Category → ContentTag Mapping [S] ✅
- [x] Add `CATEGORY_TO_TAG` dict in `triage.py`
- [x] Wire mapping into `{category_hint}` template injection (already wired via `_normalize_category_hint()`)
- [x] Handle "podcast" → "learning" + narrative modifier hint
- [x] Handle "gaming" → "tech" merge
- [x] `_CATEGORY_FALLBACK` extended with aliases (recipe→food, code→tech, etc.)
- [x] All 11 category_rules categories map correctly (verified via CATEGORY_TO_TAG dict)
- [x] Unknown category defaults to "learning" via `_CATEGORY_FALLBACK.get(normalized, "learning")`

### 1.2 Scenario Enrichment Prompt [M] ✅ (ALREADY DONE)
- [x] enrich_study.txt already includes scenario generation (quiz + flashcards + scenarios)
- [x] EnrichmentData model already has `scenarios` field with Scenario and ScenarioOption models
- [x] LearningRenderer scenarios tab renders generated data via ScenarioCard component

### 1.3 Evaluate enrich_code.txt [S] ✅
- [x] Compared: tech.txt schema extracts cheatSheet, enrich_code.txt is redundant
- [x] Decision: remove code_walkthrough from ENRICHMENT_MAP (cheatSheet comes from extraction)
- [x] Removed "code_walkthrough" from ENRICHMENT_MAP in enrichment.py
- [x] Updated test_enrichment.py: code_walkthrough now returns None
- [x] Updated test_pipeline_integration.py: code_walkthrough in non-enrichable parametrize list
- [x] All tests pass (183 summarizer tests)

---

## Phase 2: Schema-Renderer Gap Closure — Priority: HIGH

### 2.1 Field Audit (All Domains) [M] ✅
- [x] **All 9 domains audited**: Learning, Tech, Fitness, Food, Music, Travel, Review, Project, Narrative
- [x] **Result: ALL schema fields are rendered.** No missing high-value fields found.
- [x] Food: equipment[], substitutions[], nutrition[] — all rendered
- [x] Travel: accommodationTips, transportationTips, bestSeason — all rendered
- [x] Fitness: modifications[], formCues[], warmup/cooldown separation — all rendered
- [x] Tech: setup.envVars[], setup.dependencies[] — all rendered
- [x] Review: verdict.bestFor[], verdict.notFor[], comparisons[] — all rendered
- [x] Project: tools[].alternative, steps[].safetyNote, estimatedCost — all rendered
- [x] Music: structure[].timestamp, structure[].duration, lyrics[].timestamp — all rendered

### 2.2 Render Missing High-Value Fields [L] ✅ (NO CHANGES NEEDED)
- [x] All fields already rendered — no gaps to close

### 2.3 Remove Unused Schema Fields [S] ✅ (NO CHANGES NEEDED)
- [x] No unused fields found — all schema fields are consumed by renderers

---

## Phase 3: Organizational Cleanup — Priority: MEDIUM

### 3.1 Move Enrichment Components [S] ✅
- [x] Created `output/enrichment/` directory
- [x] FlashCard, ScenarioCard, ScoreRing, SpotCard copied to output/enrichment/
- [x] Created output/enrichment/index.ts with exports
- [x] Test files created in output/enrichment/__tests__/
- [x] Domain renderer imports updated (ReviewRenderer→ScoreRing, TravelRenderer→SpotCard)
- [x] InteractiveBlockShowcase imports updated
- [x] Added missing BLOCK_LABELS (flashCards, of, tapToFlip, scenarios, scenario, yourScore, openInMaps, searchBooking)
- [x] All 1230 web tests pass

### 3.2 Clean Up Legacy OutputSection [S] ✅ (DOCUMENTED)
- [x] Grepped for IntentResult/OutputSection usage
- [x] **Actively used by**: TabLayout, OutputSkeleton, OutputShell, stream-event-processor, use-summary-stream, stream-cache
- [x] Decision: Keep — required by tracked (old) architecture. Will be removed when ComposableOutput replaces OutputShell.

### 3.3 Rename activeSection → activeTabId [S] ✅ (ALREADY DONE)
- [x] ComposableOutput and all 9 domain renderers already use `activeTabId`

### 3.4 Surface Synthesis in UI [M] ✅ (ALREADY DONE)
- [x] OutputShell already displays:
  - TLDR in GlassCard below hero
  - Key takeaways as elevated GlassCard with emoji bullets
- [x] SharePage uses OutputShell which includes synthesis display

---

## Phase 4: Prompt Quality — Priority: MEDIUM

### 4.1 Overview-Avoidance in Triage [S] ✅ (ALREADY DONE)
- [x] triage.txt already has FIRST TAB SELECTION section

### 4.2 Video-Specific Tab Labels [S] ✅ (ALREADY DONE)
- [x] triage.txt already has TAB LABEL RULES section

### 4.3 Cross-Domain FlashCard/ScenarioCard [DEFERRED]
- [ ] → Separate task: `cross-domain-enrichment`

---

## Test Results

| Suite | Result |
|-------|--------|
| API (Vitest) | **606 passed**, 9 skipped ✅ |
| Web (Vitest) | **1230 passed** ✅ |
| Summarizer (pytest) | **183 passed** ✅ |
| Playwright: output-layout | **19 passed** ✅ |
| Playwright: all-domains | **31 failed** ⚠️ (expected — tests target untracked ComposableOutput architecture) |

### all-domains failures explained
The `all-domains.spec.ts` tests provide `triage.tabs` in mock data, which only `ComposableOutput` reads. The current tracked `OutputRouter` delegates to `OutputShell` which uses `intent.sections` (empty in the mock). Once `OutputRouter` is updated to use `ComposableOutput`, these tests will pass.

---

## Progress Summary

| Phase | Status | Tasks | Complete |
|-------|--------|-------|----------|
| 1. Critical Alignment | ✅ Complete | 3 | 3/3 |
| 2. Schema-Renderer Gap | ✅ Complete (no gaps) | 3 | 3/3 |
| 3. Organizational Cleanup | ✅ Complete | 4 | 4/4 |
| 4. Prompt Quality | ✅ Complete (1 deferred) | 3 (1 deferred) | 2/2 |
| **Total** | **✅ Complete** | **13 (1 deferred)** | **12/12** |

## Known Remaining Work (Out of Scope)
1. **Wire ComposableOutput into OutputRouter**: OutputRouter currently delegates to OutputShell (old architecture). When switched to ComposableOutput, all-domains e2e tests will pass.
2. **Remove enrich_code.txt prompt file**: File still exists on disk but is no longer referenced by ENRICHMENT_MAP.
3. **Cross-domain enrichment**: FlashCard/ScenarioCard for non-learning domains (deferred to separate task).
