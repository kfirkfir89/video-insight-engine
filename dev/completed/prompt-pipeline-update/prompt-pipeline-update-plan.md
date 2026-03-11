# Prompt & Pipeline Update Plan

Last Updated: 2026-03-10

## Executive Summary

Comprehensive overhaul of VIE's prompt system and extraction pipeline in 4 phases:
1. **Phase 1** — Fix existing prompts (accuracy_rules, triage examples, voice guide, finance dedup)
2. **Phase 2** — Schema improvements (food numeric amounts, travel structured tips, music structured analysis) with Pydantic sync
3. **Phase 3** — New manifest pipeline stage (pre-triage transcript scan for content density/structure)
4. **Phase 4** — Category-to-contentTag alignment mapping

## Current State

### Pipeline Flow (as of 2026-03-10)
```
1. Metadata (yt-dlp)
2. Transcript (fetch + clean + SponsorBlock)
3. Triage + Description Analysis (concurrent)
   └─ Triage receives: title, description, duration, category_hint, transcript_preview[:2000]
4. Extraction (adaptive: single/overflow/segmented)
   └─ Injected: accuracy_rules.txt + schemas/*.txt via base_extraction.txt
5. Enrichment (learning only → enrich_study.txt)
6. Synthesis (TLDR, takeaways, masterSummary, seoDescription)
7. Save to MongoDB
```

### Key Issues
- `accuracy_rules.txt` — References "prose", "tone matching", "writing to the reader". VIE extracts structured JSON, not prose
- `triage.txt` examples — Show "overview" first tab and generic labels, contradicting rules that say "avoid overview first" and "use specific labels"
- `base_extraction.txt` — No guidance on which fields get "voice" vs pure data
- `finance.txt` — Duplicates `budget` object when travel+finance modifier both active
- `food.txt` — `amount` is string, can't do math for serving scaling
- `travel.txt` — `accommodationTips`/`transportationTips` are single strings, not arrays
- `music.txt` — `analysis` is single text blob, not structured
- Triage receives raw `transcript_preview[:2000]` — a manifest would give structured content density info

## Proposed Future State

### Pipeline Flow (after all phases)
```
1. Metadata (yt-dlp)
2. Transcript (fetch + clean + SponsorBlock)
3. Manifest + Description Analysis (concurrent, cheap/fast model)
   └─ Manifest: structural scan → itemCounts, sections, keyNames, contentType
4. Triage (receives manifest instead of transcript_preview)
5. Extraction (unchanged, but better accuracy_rules)
6. Enrichment (unchanged)
7. Synthesis (unchanged)
8. Post-processing: validate extraction counts against manifest.itemCounts
9. Save to MongoDB
```

---

## Phase 1: Fix What Exists (prompt text only, zero risk)

### Step 1: Rewrite accuracy_rules.txt
- **Effort:** S
- **Risk:** Low (prompt text only, injected via `{accuracy_rules}` placeholder)
- **What:** Replace 22-line file with structured JSON-extraction-focused rules
- **Key sections:** DATA INTEGRITY, TIP & DESCRIPTION VOICE, FIELD-LEVEL ACCURACY
- **Acceptance:** File updated, no code changes needed

### Step 2: Fix triage.txt examples
- **Effort:** S
- **Risk:** Low (prompt text only)
- **What:** Replace 3 examples (default/learning, travel, food) to match stated rules
- **Key changes:** No "overview" as first tab, specific labels with counts, food example without overview
- **Acceptance:** Examples align with rules (no overview first, specific labels)

### Step 3: Add voice field guide to base_extraction.txt
- **Effort:** S
- **Risk:** Low (prompt text only)
- **What:** Add "WHERE VOICE APPLIES" section after VIE VOICE RULES
- **Key guidance:** tip/tips = full voice, name/title = exact, instruction/code = precise, other = data accuracy
- **Acceptance:** Section added, extraction prompt is clearer about which fields get personality

### Step 4: Verify enrich_code.txt deletion
- **Effort:** S
- **Risk:** Low
- **What:** Confirm enrich_code.txt is deleted AND no pipeline code references it
- **Status:** File already deleted per git status. Verify no dangling references in enrichment.py
- **Acceptance:** No references to enrich_code anywhere in codebase

### Step 5: Fix finance.txt budget duplication
- **Effort:** S
- **Risk:** Low (prompt text only)
- **What:** Replace finance.txt to clarify it only adds `costs[]` and `savingTips[]`, not a duplicate `budget`
- **Key rule:** "Do NOT duplicate budget data that's already in the primary domain schema"
- **Acceptance:** Finance modifier schema is clear about non-duplication

---

## Phase 2: Schema Improvements (Pydantic + frontend sync)

### Step 6: food.txt — numeric amounts for scaling
- **Effort:** M
- **Risk:** Medium (Pydantic model + frontend changes)
- **Changes:**
  - food.txt: `amount` → `amount` (float) + `displayAmount` (string) + `unit` (string)
  - domain_types.py: Update FoodData Ingredient model
  - Frontend: Update any ingredient rendering to use `displayAmount` for display, `amount` for math
- **Depends on:** Step 1
- **Acceptance:** Ingredients have numeric amounts for scaling, display amounts for UI

### Step 7: travel.txt — structured tip arrays
- **Effort:** M
- **Risk:** Medium (Pydantic model + frontend changes)
- **Changes:**
  - travel.txt: `accommodationTips`/`transportationTips` → array of `{text, type}` objects
  - domain_types.py: Update TravelData model
  - Frontend TravelRenderer: Render tip arrays with severity styling
- **Depends on:** Step 1
- **Acceptance:** Tips render as styled callout blocks with tip/warning/info types

### Step 8: music.txt — structured analysis
- **Effort:** M
- **Risk:** Medium (Pydantic model + frontend changes)
- **Changes:**
  - music.txt: `analysis` string → array of `{aspect, emoji, detail}` objects
  - domain_types.py: Update MusicData model
  - Frontend MusicRenderer: Render analysis as expandable cards
- **Depends on:** Step 1
- **Acceptance:** Music analysis renders as structured aspect cards

---

## Phase 3: Manifest Pipeline Stage

### Step 9: Create manifest.txt prompt
- **Effort:** M
- **Risk:** Medium (new file)
- **What:** New prompt for structural transcript scan
- **Output:** summary, contentType, mainTopics, itemCounts, sections, keyNames, pricesMentioned, budgetDiscussed, hasStorytelling, speakerCount
- **Acceptance:** Prompt file exists, well-structured

### Step 10: Wire manifest into pipeline
- **Effort:** L
- **Risk:** High (new pipeline stage)
- **Changes:**
  - Create ManifestResult + ItemCounts + ManifestSection Pydantic models in pipeline_types.py
  - Create manifest stage (services/pipeline/manifest.py or similar)
  - Update stream.py: manifest runs concurrent with description_analysis, before triage
  - Use cheapest/fastest model (this is classification, not extraction)
  - 10-second timeout
- **Depends on:** Step 9
- **Acceptance:** Manifest stage runs, returns structured data, doesn't block pipeline on failure

### Step 11: Update triage.txt to consume manifest
- **Effort:** M
- **Risk:** High (changes triage input contract)
- **Changes:**
  - Replace `{transcript_preview}` with `{manifest}` in triage.txt
  - Update triage.py to pass manifest data instead of transcript_preview
  - Remove transcript_preview[:2000] slicing
- **Depends on:** Step 10
- **Acceptance:** Triage uses manifest, no longer needs raw transcript text

### Step 12: Add extraction count validation
- **Effort:** M
- **Risk:** Medium (new validation, non-blocking)
- **Changes:**
  - Add `validate_extraction_counts()` to post_processor.py
  - Compare manifest.itemCounts against extraction output
  - Log warnings if extraction < 60% of manifest counts
  - Non-blocking: just logs, doesn't fail pipeline
- **Depends on:** Step 10
- **Acceptance:** Warnings logged when extraction seems to drop items

---

## Phase 4: Category Alignment

### Step 13: Add category → contentTag mapping
- **Effort:** S
- **Risk:** Low (1 function)
- **What:** Ensure category_rules.json categories map correctly to triage contentTag names
- **Note:** triage.py already has `CATEGORY_TO_TAG` dict doing this mapping
- **Action:** Verify mapping is complete and correct, add any missing entries
- **Acceptance:** All category_rules.json categories map to valid contentTags

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prompt changes degrade output quality | High | Phase 1 is text-only; test with real videos before deploying |
| Schema changes break frontend | Medium | Update Pydantic + TypeScript types + renderers in same PR |
| Manifest adds latency | Medium | Use cheapest model, 10s timeout, run concurrent with description_analysis |
| Manifest LLM fails | Low | Pipeline continues without manifest, triage falls back to transcript_preview |
| Old cached data incompatible | Medium | Clear DB cache after schema changes (Phase 2+) |

## Success Metrics

1. **Accuracy:** Extraction preserves exact names, numbers, counts from video
2. **Completeness:** Manifest itemCounts vs extraction counts within 60% threshold
3. **Tab quality:** No generic "Overview" as first tab, specific labels with counts
4. **Schema richness:** Food amounts scalable, travel tips typed, music analysis structured
5. **Latency:** Manifest stage adds <2s (concurrent with description_analysis)

## Post-Completion Cleanup

- Delete `transcript_preview` variable construction from stream.py
- Delete `transcript_preview[:2000]` slice in triage.py
- Remove `classify_category_with_llm()` dead code if manifest makes it irrelevant
- Clear DB + cache (schema changes mean old data is incompatible)
