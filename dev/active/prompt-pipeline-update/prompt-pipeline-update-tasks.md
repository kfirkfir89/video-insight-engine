# Prompt & Pipeline Update — Tasks

Last Updated: 2026-03-10

## Phase 1: Fix What Exists (prompt text only)

- ✅ **Step 1: Rewrite accuracy_rules.txt** [S]
  - ✅ Replace entire file with JSON-extraction-focused rules
  - ✅ Sections: DATA INTEGRITY, TIP & DESCRIPTION VOICE, FIELD-LEVEL ACCURACY
  - ✅ Remove references to "prose", "tone matching", "writing to the reader"
  - ✅ Add field-specific accuracy rules (cost/price, measurement, comparison, timestamp, enumeration)

- ✅ **Step 2: Fix triage.txt examples** [S]
  - ✅ Replace default/learning example (no overview first, specific labels with counts)
  - ✅ Replace travel example (no overview first, itinerary/budget/packing tabs)
  - ✅ Replace food example (ingredients/steps/tips, no overview)
  - ✅ Verify examples match stated rules about tab ordering and specificity

- ✅ **Step 3: Add voice field guide to base_extraction.txt** [S]
  - ✅ Add "WHERE VOICE APPLIES" section after VIE VOICE RULES
  - ✅ Map: tip/tips → full voice, description/detail → factual dense, name/title → exact, instruction/code → precise

- ✅ **Step 4: Verify enrich_code.txt deletion** [S]
  - ✅ Confirm file is deleted (git status shows D)
  - ✅ Grep codebase for "enrich_code" references — none found
  - ✅ Verify enrichment.py ENRICHMENT_MAP has no "tech" entry

- ✅ **Step 5: Fix finance.txt budget duplication** [S]
  - ✅ Replace finance.txt with costs[] + savingTips[] only schema
  - ✅ Add rule: "Do NOT duplicate budget data from primary domain schema"
  - ✅ Remove standalone budget object from finance modifier
  - ✅ Updated FinanceData Pydantic model — removed `budget` field
  - ✅ Updated TypeScript FinanceData type — removed `budget?`

---

## Phase 2: Schema Improvements (Pydantic + frontend)

- ✅ **Step 6: food.txt — numeric amounts** [M]
  - ✅ Update food.txt: amount (float) + displayAmount (string) + unit (string)
  - ✅ Add rules for numeric conversion (0.5 not "1/2", midpoint for ranges)
  - ✅ Update FoodIngredient Pydantic model: `amount: float` + `display_amount: str` with coerce validator
  - ✅ Update TypeScript FoodIngredient type: `amount: number` + `displayAmount: string`
  - ⏳ Update FoodRenderer (if using amount for display) — **NOT DONE, frontend renderer not modified**
  - ⏳ Clear DB cache for food-tagged videos — **deployment task**

- ✅ **Step 7: travel.txt — structured tip arrays** [M]
  - ✅ Update travel.txt: accommodationTips/transportationTips → array of {text, type}
  - ✅ Add type enum: "tip" | "warning" | "info"
  - ✅ Update TravelData Pydantic model + TravelTip model with legacy string coercion
  - ✅ Update TypeScript TravelData type + TravelTip interface
  - ⏳ Update TravelRenderer to render tip arrays with severity styling — **NOT DONE**
  - ⏳ Clear DB cache for travel-tagged videos — **deployment task**

- ✅ **Step 8: music.txt — structured analysis** [M]
  - ✅ Update music.txt: analysis string → array of {aspect, emoji, detail}
  - ✅ Add common aspects list: Production, Influences, Vocals, etc.
  - ✅ Update MusicData Pydantic model + MusicAnalysisItem with legacy string coercion
  - ✅ Update TypeScript MusicData type + MusicAnalysisItem interface
  - ⏳ Update MusicRenderer to render analysis as expandable cards — **NOT DONE**
  - ⏳ Clear DB cache for music-tagged videos — **deployment task**

---

## Phase 3: Manifest Pipeline Stage

- ✅ **Step 9: Create manifest.txt prompt** [M]
  - ✅ Create services/summarizer/src/prompts/manifest.txt
  - ✅ Define output schema: summary, contentType, mainTopics, itemCounts, sections, keyNames, flags
  - ✅ Add counting rules and accuracy instructions
  - ✅ Use double-brace escaping for JSON template (Python .format())

- ✅ **Step 10: Wire manifest into pipeline** [L]
  - ✅ Create ItemCounts, ManifestSection, ManifestFlags, ManifestResult Pydantic models
  - ✅ Create services/summarizer/src/services/pipeline/manifest.py
  - ✅ Implement manifest stage: load prompt, call LLM, parse response
  - ✅ Add 10-second asyncio.wait_for timeout
  - ✅ Add fallback: returns None on failure, pipeline continues without it
  - ✅ Update stream.py: run manifest concurrent with description_analysis
  - ✅ Pass manifest result to triage stage via format_manifest_for_triage()
  - ✅ Write tests for manifest stage (13 tests in test_manifest.py)

- ✅ **Step 11: Update triage.txt to consume manifest** [M]
  - ✅ Replace {transcript_preview} with {manifest} in triage.txt
  - ✅ Update triage.py: accepts manifest_text param, formats into prompt
  - ✅ Triage falls back to transcript_preview[:2000] when no manifest
  - ✅ Tests pass (21 triage tests)

- ✅ **Step 12: Add extraction count validation** [M]
  - ✅ Add validate_extraction_counts() to post_processor.py
  - ✅ Implement _count_items_at_path() with wildcard (*) support
  - ✅ Compare manifest counts vs extraction counts (COMPLETENESS_THRESHOLD=0.6)
  - ✅ Log warnings (non-blocking)
  - ✅ Wire into stream.py post-extraction
  - ✅ Write tests (14 new tests: 5 for _count_items_at_path, 9 for validate_extraction_counts)

---

## Phase 4: Category Alignment

- ✅ **Step 13: Verify category → contentTag mapping** [S]
  - ✅ CATEGORY_TO_TAG covers all 8 content tags
  - ✅ "standard" → "learning" mapping exists
  - ✅ _CATEGORY_FALLBACK has broader keyword coverage (recipe, code, programming, etc.)

---

## Post-Completion Cleanup

- ⏳ Update frontend renderers for new schema types (Food/Travel/Music)
- ⏳ Clear DB + cache (schema changes) — deployment task
- ✅ Update MEMORY.md with new pipeline flow
- ⏳ Update SERVICE-SUMMARIZER.md docs
- ⏳ Delete dead code: FinanceBudget, FinanceBudgetItem classes if unused by frontend
