# VIE System Audit — Strategic Plan

Last Updated: 2026-03-10

## Executive Summary

Audit of the full pipeline (category_rules.json → triage → schemas → renderers → blocks) reveals
3 systemic issues and ~30% underutilization of extraction schemas. The tab-routing layer is clean —
all 9 domain renderers handle every allowed tab ID. The gaps are in: (1) naming misalignment between
pre-triage heuristics and triage contentTags, (2) schema fields extracted but never rendered,
(3) missing enrichment prompts for features that have frontend support.

## Current State

### What Works
- 8 content domains + 2 modifiers (narrative, finance) — fully implemented
- 9 domain renderers — all tab IDs handled correctly
- 10 extraction schemas — well-structured with strict rules
- ComposableOutput → domain renderer routing — clean
- TabDefinition type (new) properly distinct from OutputSection (legacy)

### What's Broken/Missing
1. **category_rules.json** uses 11 categories that don't map to 8 triage contentTags
2. **~15 schema fields** extracted by LLM but never rendered in frontend
3. **scenarios tab** has frontend support (ScenarioCard) but no enrichment prompt
4. **enrich_code.txt** likely redundant with extraction schema's cheatSheet
5. **Triage prompt** allows generic "overview" as first tab (suboptimal UX)
6. **Synthesis fields** (masterSummary, keyTakeaways, seoDescription) not rendered in UI
7. **4 enrichment components** (FlashCard, ScenarioCard, ScoreRing, SpotCard) in blocks/ but
   aren't ContentBlocks — organizational confusion

---

## Implementation Phases

### Phase 1: Critical Alignment (Backend)
Fix naming mismatches and missing data generation that affect output quality.

### Phase 2: Schema-Renderer Gap Closure (Frontend + Backend)
Either render extracted-but-hidden fields or stop extracting them (save tokens).

### Phase 3: Organizational Cleanup (Frontend)
Move components to correct directories, clean up types, improve naming.

### Phase 4: Prompt Quality (Backend)
Improve triage prompt heuristics, tab labels, overview-avoidance.

---

## Phase 1: Critical Alignment

### 1.1 Add category → contentTag mapping layer
**Effort:** S | **Risk:** Low | **Impact:** High

category_rules.json outputs: cooking, coding, education, podcast, reviews, gaming, diy, standard
triage.txt expects: food, tech, learning, (none), review, (merged to tech), project, learning

**Implementation:** Add `CATEGORY_TO_TAG` mapping in the triage service (Python) that translates
category_rules output before injecting into `{category_hint}` template variable.

```python
# In services/summarizer/src/services/pipeline/triage.py
CATEGORY_TO_TAG = {
    "cooking": "food",
    "coding": "tech",
    "education": "learning",
    "reviews": "review",
    "diy": "project",
    "gaming": "tech",
    "podcast": "learning",  # + narrative modifier hint
    "standard": "learning",
    "fitness": "fitness",
    "travel": "travel",
    "music": "music",
}
```

**Files:** `services/summarizer/src/services/pipeline/triage.py`
**Acceptance:** category_hint arrives as valid contentTag; unit test covers all 11 mappings

### 1.2 Add scenario generation to enrich_study.txt
**Effort:** M | **Risk:** Medium | **Impact:** High

`scenarios` tab ID is allowed for learning domain. ScenarioCard component exists.
No enrichment prompt generates scenario data.

**Implementation:** Extend enrich_study.txt to generate 3-5 scenario items:
```json
{
  "quiz": [...],
  "flashcards": [...],
  "scenarios": [
    {
      "title": "...",
      "description": "...",
      "options": [
        { "label": "...", "explanation": "...", "isCorrect": true/false }
      ]
    }
  ]
}
```

**Files:** `services/summarizer/src/prompts/enrich_study.txt`, `services/summarizer/src/services/pipeline/enrichment.py`
**Acceptance:** Scenarios appear in learning domain output; ScenarioCard renders them
**Dependencies:** Verify ScenarioCard props match generated data shape

### 1.3 Evaluate enrich_code.txt redundancy
**Effort:** S | **Risk:** Low | **Impact:** Medium

tech.txt extraction schema already has `cheatSheet[]`. enrich_code.txt also generates cheatSheet.
Determine if they produce identical or complementary data.

**Decision tree:**
- If identical → delete enrich_code.txt, rely on extraction
- If complementary → merge into extraction schema and delete enrichment
- If genuinely different (interactive challenges) → keep but rename/expand

**Files:** `services/summarizer/src/prompts/enrich_code.txt`, `services/summarizer/src/prompts/schemas/tech.txt`
**Acceptance:** No duplicate LLM calls for same data

---

## Phase 2: Schema-Renderer Gap Closure

### 2.1 Audit each renderer against its schema (VERIFY phase)
**Effort:** M | **Risk:** Low | **Impact:** High (informs all other Phase 2 tasks)

For each domain, read the renderer code and mark which schema fields are actually rendered.

**Domains to check (known gaps from audit):**

| Domain | Suspected Unrendered Fields |
|--------|----------------------------|
| Food | equipment[], substitutions[], nutrition[], ingredients[].notes, steps[].timestamp, tips[].type differentiation |
| Travel | accommodationTips, transportationTips, bestSeason, spots[].duration, packingList[].category grouping, packingList[].essential styling |
| Fitness | exercises[].modifications[], warmup/cooldown separation, exercises[].formCues display, meta.caloriesBurned |
| Tech | setup.envVars[], setup.dependencies[] display |
| Review | verdict.bestFor[], verdict.notFor[], comparisons[] usage |
| Project | tools[].alternative, steps[].safetyNote, steps[].duration, estimatedCost |
| Music | structure[].timestamp linking, structure[].duration, lyrics[].timestamp |

**Files:** All 9 renderers + 10 schemas
**Acceptance:** Spreadsheet of field → rendered status for every domain

### 2.2 Render high-value missing fields (per domain)
**Effort:** L | **Risk:** Medium | **Impact:** High

After 2.1 confirms gaps, add rendering for fields that improve UX:

**Priority rendering additions:**
1. **Food overview tab**: Add equipment section, substitutions in tips tab
2. **Travel overview tab**: Add bestSeason stat, accommodationTips, transportationTips
3. **Fitness exercises tab**: Separate warmup/cooldown sections, show modifications in FitnessBlock
4. **Tech setup tab**: Add envVars as key-value table
5. **Review verdict tab**: Render bestFor/notFor lists
6. **Project overview tab**: Show estimatedCost stat

**Files:** Domain renderer files in `apps/web/src/components/video-detail/output/domain-renderers/`
**Acceptance:** Each field renders correctly; no layout breakage; tests updated

### 2.3 Remove extraction of truly unwanted fields (save tokens)
**Effort:** S | **Risk:** Low | **Impact:** Medium

After 2.1 and 2.2, any remaining unrendered fields should be removed from schemas
to save LLM tokens (each field costs extraction time).

**Files:** Schema files in `services/summarizer/src/prompts/schemas/`
**Acceptance:** Schemas only contain fields that are rendered or planned for rendering

---

## Phase 3: Organizational Cleanup

### 3.1 Move enrichment components out of blocks/
**Effort:** S | **Risk:** Low | **Impact:** Medium (clarity)

FlashCard, ScenarioCard, ScoreRing, SpotCard are NOT ContentBlocks dispatched through
ContentBlockRenderer. They're specialized interactive surfaces used directly by domain renderers.

**Move to:** `apps/web/src/components/video-detail/output/enrichment/`

**Update imports in:**
- LearningRenderer (FlashCard, ScenarioCard)
- TravelRenderer (SpotCard)
- ReviewRenderer (ScoreRing)
- blocks/index.ts (remove exports)
- InteractiveBlockShowcase.tsx (update imports)
- Test files

**Files:** 4 component files + 4 test files + ~6 import sites
**Acceptance:** All imports resolve; all tests pass; design system showcase works

### 3.2 Clean up legacy OutputSection type
**Effort:** S | **Risk:** Low | **Impact:** Low

OutputSection (in output-types.ts) is the OLD intent-detection type.
TabDefinition (in vie-response.ts) is the NEW triage type.
They're not duplicates but OutputSection may be dead if intent detection is removed.

**Check:** Is IntentResult still used anywhere? If not, remove OutputSection.

**Files:** `packages/types/src/output-types.ts`, grep for IntentResult usage
**Acceptance:** No dead types; or documented reason to keep

### 3.3 Rename activeSection → activeTabId
**Effort:** S | **Risk:** Low | **Impact:** Low (clarity)

The prop is semantically a tab ID, not a section. Rename across all 9 renderers + ComposableOutput.

**Files:** ComposableOutput.tsx + 9 domain renderers + their prop interfaces
**Acceptance:** Consistent naming; all tests pass

### 3.4 Surface synthesis data in UI
**Effort:** M | **Risk:** Low | **Impact:** Medium

masterSummary, keyTakeaways, seoDescription are generated but not rendered.
Options:
- Add tldr as subtitle in video detail header
- Add keyTakeaways as collapsible section above tabs
- Use seoDescription for OG meta tags on share pages

**Files:** VideoDetailPage.tsx, SharePage.tsx, meta tag handling
**Acceptance:** At least tldr + keyTakeaways visible in UI

---

## Phase 4: Prompt Quality

### 4.1 Add overview-avoidance guidance to triage prompt
**Effort:** S | **Risk:** Low | **Impact:** Medium

Add rules to triage.txt discouraging "overview" as first tab when a more specific tab exists.

```
FIRST TAB GUIDANCE:
- Food → start with "ingredients" (the recipe)
- Tech → start with "code" or "patterns" (the content)
- Review → start with "verdict" (what user came for)
- Fitness → start with "exercises" (the workout)
- Project → start with "steps" (the build guide)
- "overview" only when no single tab captures primary content
```

**Files:** `services/summarizer/src/prompts/triage.txt`
**Acceptance:** Manual test with 5 videos shows improved first-tab selection

### 4.2 Enforce video-specific tab labels
**Effort:** S | **Risk:** Low | **Impact:** High (UX)

Current triage examples use generic labels ("Key Points", "Itinerary").
Add explicit rule requiring video-specific labels with numbers when available.

```
TAB LABEL RULES:
- MUST be specific to this video's content
- Include key numbers: days, score, cost, exercise count
- Examples: "7 Days in Japan" not "Itinerary", "8.5/10 Verdict" not "Verdict"
```

**Files:** `services/summarizer/src/prompts/triage.txt`
**Acceptance:** Manual test shows video-specific labels

### 4.3 Make FlashCard/ScenarioCard available cross-domain
**Effort:** M | **Risk:** Medium | **Impact:** Medium

Currently FlashCard is learning-only. As presentation patterns, they should be usable by any renderer.
This requires:
1. Schema changes (add flashcard-compatible items to other domains)
2. Renderer changes (import and render FlashCard in non-learning renderers)
3. Triage changes (allow flashcards/scenarios tab IDs for more domains)

**Defer to separate task** — this is a design decision that needs prototyping.

**Files:** Multiple schemas, renderers, triage prompt
**Acceptance:** At least one non-learning domain can render FlashCards

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Category mapping breaks existing triage | High | Low | Unit test all 11 mappings; LLM still makes final call |
| Adding fields to renderers breaks layout | Medium | Medium | Test each domain with real video data |
| Moving components breaks imports | Low | Low | IDE refactoring; run full test suite |
| Prompt changes degrade output quality | High | Medium | A/B test with 10 videos before/after |
| Removing schema fields loses useful data | Medium | Low | Only remove after confirmed unrendered |

## Success Metrics

1. **Zero naming mismatches** between category_rules and triage contentTags
2. **<10% token waste** — all extracted fields either rendered or removed
3. **All enrichment tab IDs** have corresponding generation prompts
4. **Video-specific tab labels** in >80% of outputs (manual check)
5. **First tab is NOT "overview"** in >60% of domain outputs (when specific tab available)

## Dependencies

- Phase 2 depends on Phase 2.1 audit results
- Phase 3.1 (component move) is independent, can run in parallel with Phase 1
- Phase 4.3 (cross-domain enrichment) depends on Phase 3.1 (component relocation)
- All prompt changes (Phase 4) should be tested against real video outputs
