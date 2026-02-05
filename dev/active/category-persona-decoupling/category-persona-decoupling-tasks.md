# Category-Persona Decoupling - Task Checklist

**Last Updated**: 2026-02-05

---

## Phase 1: Foundation (S - 2-3 hours) ✅ COMPLETE

### 1.1 Update VideoContext Dataclass
- [x] **[P1-1]** Add `category: str` field to `VideoContext` dataclass in `youtube.py`
- [x] **[P1-2]** Update VideoContext docstring to explain category vs persona distinction
- [x] **[P1-3]** Update all VideoContext instantiations to include category field

**Acceptance Criteria**: ✅
- VideoContext has both `category` and `persona` fields
- All existing code compiles without errors

### 1.2 Create Category Rules Configuration
- [x] **[P1-4]** Create `category_rules.json` in `prompts/detection/`
- [x] **[P1-5]** Define weighted scoring configuration
- [x] **[P1-6]** Add all 10 category definitions with keywords, YouTube categories, patterns
- [x] **[P1-7]** Add `_load_category_rules()` function with `@lru_cache`

**Acceptance Criteria**: ✅
- JSON file validates and loads correctly
- All 10 categories have primary and secondary keywords
- Weights sum to 1.0

---

## Phase 2: Category Detection (M - 4-6 hours) ✅ COMPLETE

### 2.1 Implement _detect_category()
- [x] **[P2-1]** Create `_detect_category()` function signature
- [x] **[P2-2]** Implement keyword scoring (weight 0.40)
  - Primary keywords: full score
  - Secondary keywords: 0.5x score
- [x] **[P2-3]** Implement YouTube category scoring (weight 0.30)
  - Primary categories: full score
  - Secondary categories: 0.5x score
- [x] **[P2-4]** Implement title pattern matching (weight 0.15)
- [x] **[P2-5]** Implement channel pattern matching (weight 0.15)
- [x] **[P2-6]** Return category with highest score and confidence value
- [x] **[P2-7]** Add logging for category detection decisions

**Acceptance Criteria**: ✅
- Function returns (category, confidence) tuple
- Confidence is 0.0-1.0
- Handles None/empty inputs gracefully

### 2.2 Implement _select_persona()
- [x] **[P2-8]** Create `_select_persona(category: str) -> str` function
- [x] **[P2-9]** Implement category-to-persona mapping dictionary
- [x] **[P2-10]** Return "standard" for unmapped categories

**Acceptance Criteria**: ✅
- All mapped categories return correct persona
- Unknown categories return "standard"

---

## Phase 3: LLM Fallback (M - 3-4 hours) ✅ COMPLETE

### 3.1 Add Fast Model Support to LLMProvider
- [x] **[P3-1]** Add `complete_fast()` method to `LLMProvider` class
- [x] **[P3-2]** Ensure it uses `self._fast_model` instead of `self._model`
- [x] **[P3-3]** Add error handling for timeout/rate limit

**Acceptance Criteria**: ✅
- Uses fast_model (Haiku) for quick classifications
- Has shorter timeout (5s vs 60s default)
- Handles errors gracefully

### 3.2 Implement LLM Classification Fallback
- [x] **[P3-4]** Create `classify_category_with_llm()` async function
- [x] **[P3-5]** Design classification prompt (list categories, ask for single answer)
- [x] **[P3-6]** Parse and validate LLM response
- [x] **[P3-7]** Return "standard" on invalid response
- [x] **[P3-8]** Add logging for LLM fallback usage

**Acceptance Criteria**: ✅
- Function returns valid category value
- Prompt is concise (<500 chars)
- Handles LLM errors gracefully

---

## Phase 4: Integration (M - 4-5 hours) ✅ COMPLETE

### 4.1 Update extract_video_context()
- [x] **[P4-1]** Add optional `channel` and `title` parameters
- [x] **[P4-2]** Call `_detect_category()` for rule-based detection
- [x] **[P4-3]** Check confidence threshold (0.4)
- [x] **[P4-4]** Mark low-confidence cases for LLM fallback (via category_confidence field)
- [x] **[P4-5]** Call `_select_persona()` based on detected category
- [x] **[P4-6]** Return VideoContext with both category and persona

**Acceptance Criteria**: ✅
- Function works synchronously for high-confidence cases
- Returns VideoContext with correct category and persona

### 4.2 Handle Async LLM Fallback in stream.py
- [x] **[P4-7]** Create `finalize_video_context()` async function
- [x] **[P4-8]** Call LLM fallback for low-confidence category cases
- [x] **[P4-9]** Update `stream_summarization()` to await context finalization

**Acceptance Criteria**: ✅
- LLM fallback is called only when confidence < 0.4
- Processing continues even if LLM fallback fails

### 4.3 Update extract_context() in stream.py
- [x] **[P4-10]** Remove persona_to_category reverse mapping
- [x] **[P4-11]** Use `video_data.context.category` directly
- [x] **[P4-12]** Keep persona for LLM prompt selection

**Acceptance Criteria**: ✅
- extract_context() uses category directly from VideoContext
- No more reverse mapping from persona

---

## Phase 5: Testing (M - 4-5 hours) ✅ COMPLETE

### 5.1 Unit Tests for Category Detection
- [x] **[P5-1]** Test `_detect_category()` with cooking video signals
- [x] **[P5-2]** Test `_detect_category()` with coding video signals
- [x] **[P5-3]** Test `_detect_category()` with mixed/ambiguous signals
- [x] **[P5-4]** Test `_detect_category()` returns low confidence for unclear videos
- [x] **[P5-5]** Test `_detect_category()` handles channel pattern matching

**Acceptance Criteria**: ✅
- All keyword combinations tested
- Edge cases covered
- Confidence scores validated

### 5.2 Unit Tests for Persona Selection
- [x] **[P5-6]** Test `_select_persona()` for all category mappings
- [x] **[P5-7]** Test `_select_persona()` returns "standard" for unknown categories

**Acceptance Criteria**: ✅
- All mappings tested
- Fallback behavior verified

### 5.3 Unit Tests for LLM Fallback
- [x] **[P5-8]** Test `classify_category_with_llm()` with mocked LLM response
- [x] **[P5-9]** Test LLM fallback handles invalid response
- [x] **[P5-10]** Test LLM fallback handles timeout/error

**Acceptance Criteria**: ✅
- LLM calls are properly mocked
- Error handling tested
- Response parsing validated

### 5.4 Integration Tests
- [x] **[P5-11]** Verified Jamie Oliver scenario via Python REPL (category=cooking, confidence=0.54)
- [x] **[P5-12]** Verified coding tutorial scenario (category=coding, confidence=0.71)
- [x] **[P5-13]** Verified ambiguous video triggers LLM fallback (confidence=0.15 < 0.4)

**Acceptance Criteria**: ✅
- End-to-end flow works
- Category detection correct

---

## Phase 6: Documentation & Cleanup (S - 1-2 hours) ✅ COMPLETE

### 6.1 Update Documentation
- [x] **[P6-1]** Update docstrings for modified functions
- [x] **[P6-2]** Add comments explaining category vs persona
- [ ] **[P6-3]** Update DATA-MODELS.md if VideoContext schema changes (optional, schema is internal)

### 6.2 Remove Dead Code
- [x] **[P6-4]** Remove `persona_to_category` mapping from stream.py (replaced with direct category use)
- [x] **[P6-5]** Clean up unused imports (kept _determine_persona as deprecated)

### 6.3 Verify
- [x] **[P6-6]** Python syntax verified for youtube.py, stream.py
- [x] **[P6-7]** Imports verified in docker container
- [x] **[P6-8]** Tested manually with Jamie Oliver scenario (cooking category detected)

**Acceptance Criteria**: ✅
- No syntax errors
- Manual verification successful

---

## Task Summary

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| 1. Foundation | 7 tasks | S (2-3h) | ✅ Complete |
| 2. Category Detection | 10 tasks | M (4-6h) | ✅ Complete |
| 3. LLM Fallback | 8 tasks | M (3-4h) | ✅ Complete |
| 4. Integration | 12 tasks | M (4-5h) | ✅ Complete |
| 5. Testing | 13 tasks | M (4-5h) | ✅ Complete |
| 6. Documentation | 8 tasks | S (1-2h) | ✅ Complete |
| **Total** | **58 tasks** | **M (18-25h)** | ✅ Complete |

---

## Definition of Done

- [x] All tasks completed and checked off
- [x] All unit tests added
- [x] Syntax validation passes
- [x] Jamie Oliver video shows "cooking" category (confidence 0.54)
- [x] Coding tutorial shows "coding" category (confidence 0.71)
- [ ] Frontend RecipeView displays correctly (needs manual testing)
- [ ] Code reviewed and merged

---

## Notes

### Jamie Oliver Test Video
- URL: `https://www.youtube.com/watch?v=aLLUKQaT8nw`
- Expected category: "cooking"
- Expected persona: "recipe"

### Test Results
```
Jamie Oliver video: category=cooking, confidence=0.54
Coding video: category=coding, confidence=0.71
Generic entertainment: category=cooking, confidence=0.15 (triggers LLM fallback)
```

### Quick Verification Command
```bash
curl "http://localhost:8000/api/summarize/init" -X POST \
  -H "Content-Type: application/json" \
  -d '{"youtubeId": "aLLUKQaT8nw"}'

# Check context in response
```

### Files Modified
1. `services/summarizer/src/services/youtube.py` - Added _detect_category, _select_persona, classify_category_with_llm
2. `services/summarizer/src/services/llm_provider.py` - Added complete_fast() method
3. `services/summarizer/src/routes/stream.py` - Added finalize_video_context(), updated integration
4. `services/summarizer/src/prompts/detection/category_rules.json` - New weighted scoring config
5. `services/summarizer/tests/test_youtube_service.py` - Added tests for new functions
