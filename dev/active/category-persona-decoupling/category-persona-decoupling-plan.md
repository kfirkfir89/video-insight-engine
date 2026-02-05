# Decouple Category Detection from Persona Selection

**Last Updated**: 2026-02-05
**Status**: Ready for Implementation
**Effort**: Medium (M) - 3-4 developer-days

---

## Executive Summary

Fix the flawed architecture where video category is derived from persona detection. Currently, if persona detection fails (AND logic between category + keywords), the video category incorrectly becomes "general". This breaks frontend category-specific views like `RecipeView`.

**Root Cause**: Category and persona are conflated as a single concern.

**Solution**: Decouple them into independent functions with weighted scoring for category detection and optional LLM fallback for ambiguous cases.

---

## Problem Statement

### Current (Wrong) Architecture

```
YouTube metadata → Persona detection (AND logic) → fails → "standard" → Category = "general"
```

### Jamie Oliver Example

| Signal | Value | Impact |
|--------|-------|--------|
| YouTube Category | "Entertainment" | Not in recipe's allowed list |
| Tags | "recipe", "cooking", "jamie oliver" | Clearly cooking content |
| **Result** | Persona fails → Category = "general" | Frontend uses StandardView |

### Why It's Wrong

- Category is DERIVED from persona
- Persona detection requires **both** matching category AND keywords (AND logic)
- If YouTube category doesn't match, persona fails even with strong keyword signals
- Frontend loses ability to show category-specific UI

---

## Proposed Architecture

### New Flow

```
YouTube metadata → Category detection (weighted scoring) → "cooking" (ALWAYS accurate)
                                    ↓
                   Persona selection (based on category) → "recipe" or "standard"
```

### Key Principle

**Category and Persona are SEPARATE concerns:**

| Concept | Definition | Impact |
|---------|------------|--------|
| **Category** | Video's actual subject (cooking, coding, travel) | MUST be accurate for frontend views |
| **Persona** | Which LLM prompts to use | Can fallback to "standard" without affecting category |

---

## Implementation Plan

### Phase 1: Category Detection Function

**New function**: `_detect_category()` - detects video subject using weighted scoring

**Scoring Weights**:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Keywords (tags + hashtags) | 0.40 | Strongest signal for content type |
| YouTube category | 0.30 | Unreliable alone but supportive |
| Title patterns | 0.15 | Good secondary signal |
| Channel patterns | 0.15 | Known channels have clear content type |

**Fallback Logic**:
- If confidence ≥ 0.4 → Use rule-based result
- If confidence < 0.4 → Call LLM fast model for classification (~1-2s)

### Phase 2: LLM Classification Fallback

**New async function**: `_classify_category_with_llm()` for low-confidence cases

- Uses fast/cheap model (Haiku)
- ~1-2s latency
- Only called when rule-based confidence < 0.4
- Returns one of the valid VideoCategory values

### Phase 3: Persona Selection Function

**New function**: `_select_persona()` - simple mapping from category to persona

```python
category_to_persona = {
    'cooking': 'recipe',
    'coding': 'code',
    'podcast': 'interview',
    'reviews': 'review',
    'fitness': 'fitness',
    'travel': 'travel',
    'education': 'education',
}
# Fallback to 'standard' if not in mapping
```

### Phase 4: Update VideoContext

Add `category` field separate from `persona`:

```python
@dataclass
class VideoContext:
    youtube_category: str | None   # Raw YouTube category
    category: str                   # Detected category (cooking, coding, etc.)
    persona: str                    # Selected persona for LLM
    tags: list[str]
    display_tags: list[str]
```

### Phase 5: Update Callers

- `extract_video_context()` becomes async (for LLM fallback)
- `extract_context()` in stream.py uses new VideoContext structure
- Remove reverse mapping from persona to category

---

## Files to Modify

| File | Changes | Effort |
|------|---------|--------|
| `services/summarizer/src/services/youtube.py` | Add `_detect_category()`, `_classify_category_with_llm()`, `_select_persona()`, update `VideoContext`, make `extract_video_context()` async | L |
| `services/summarizer/src/routes/stream.py` | Update `extract_context()` to use new structure, await async call | S |
| `services/summarizer/src/services/llm_provider.py` | Add `complete_fast()` method for fast model calls | S |
| `services/summarizer/src/prompts/detection/category_rules.json` | NEW: Category detection rules | M |
| `services/summarizer/tests/test_youtube_service.py` | Add tests for decoupled detection + LLM fallback | M |

---

## Category Detection Rules

### Categories and Signals

| Category | Primary Keywords | Secondary Keywords | YouTube Categories | Channel Patterns |
|----------|-----------------|--------------------|--------------------|------------------|
| cooking | recipe, cooking, cook, chef, meal | ingredient, kitchen, bake, food | Howto & Style | jamie oliver, gordon ramsay |
| coding | programming, coding, code, tutorial | javascript, python, react | Science & Technology, Education | fireship, traversy |
| fitness | workout, exercise, fitness, gym | cardio, strength, hiit | Sports, Howto & Style | athlean, jeff nippard |
| travel | travel, destination, trip, vacation | hotel, flight, itinerary | Travel & Events | kara and nate |
| education | learn, education, course, lecture | history, science, math | Education | kurzgesagt, veritasium |
| podcast | interview, podcast, conversation | talk, discussion, q&a | People & Blogs | lex fridman |
| reviews | review, unboxing, comparison | test, rating, benchmark | Science & Technology, Gaming | mkbhd, linus tech tips |
| gaming | gameplay, gaming, walkthrough | stream, lets play, speedrun | Gaming | - |
| diy | diy, build, craft, woodworking | project, handmade, repair | Howto & Style | - |

---

## Success Criteria

### Functional

- [ ] Jamie Oliver video: category = "cooking" (not "general")
- [ ] Category detection is independent of persona
- [ ] Persona can fallback to "standard" without affecting category
- [ ] All 10 category values are detectable

### Performance

- [ ] Rule-based detection: <10ms latency
- [ ] LLM fallback: ~1-2s latency (only when confidence < 0.4)
- [ ] LLM fallback rate: <20% of videos

### Quality

- [ ] All existing tests pass
- [ ] New tests for decoupled detection
- [ ] LLM fallback tests are properly mocked

---

## Risk Assessment

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM fallback increases latency | Medium | Medium | Only trigger when confidence < 0.4, use fast model |
| Breaking existing persona detection | Low | High | Keep backward compatibility, extensive tests |
| Category rules become stale | Medium | Low | External JSON config, easy to update |
| LLM fallback costs money | Low | Low | Fast model is cheap (~$0.001/call), low fallback rate |

---

## Test Plan

### Unit Tests

```bash
cd services/summarizer
pytest tests/test_youtube_service.py -v -k "category"
```

### Test Cases

1. **Jamie Oliver video** (Entertainment + cooking keywords) → category = "cooking"
2. **Coding tutorial** (Education) → category = "coding"
3. **Generic vlog** (no keywords) → category = "standard"
4. **Travel vlog** (Entertainment + travel keywords) → category = "travel"
5. **Low confidence case** → LLM fallback is called

### Integration Test

```bash
curl "http://localhost:8000/api/stream/aLLUKQaT8nw" | grep '"category"'
# Expected: "cooking"
```

---

## Verification Checklist

- [ ] Jamie Oliver video shows "cooking" category
- [ ] Frontend RecipeView displays correctly for cooking videos
- [ ] Persona can be "standard" while category is "cooking"
- [ ] LLM fallback only triggers for ambiguous content
- [ ] No regression in existing summarization flow
- [ ] Test coverage for all new functions
