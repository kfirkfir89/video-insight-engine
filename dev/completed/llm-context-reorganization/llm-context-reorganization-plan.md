# LLM Context Reorganization Plan

**Last Updated:** 2026-01-20
**Status:** Planning Complete
**Estimated Effort:** Medium (M)

---

## Executive Summary

Move all hardcoded LLM context from Python code (`llm.py`, `youtube.py`) into the `prompts/` folder, creating a single source of truth for all LLM instructions. This improves maintainability, enables non-developers to edit prompts, and provides clear organization for personas, examples, and detection rules.

---

## Current State Analysis

### Files with Hardcoded Context

| File | Items | Lines | Content |
|------|-------|-------|---------|
| `llm.py` | `PERSONA_GUIDELINES` | 20-54 | 5 persona system prompts |
| `llm.py` | `VARIANT_EXAMPLES` | 57-79 | JSON examples per persona |
| `youtube.py` | `CODE_KEYWORDS` | 32-37 | ~20 code detection keywords |
| `youtube.py` | `FOOD_KEYWORDS` | 39-43 | ~17 recipe detection keywords |
| `youtube.py` | `TECH_CATEGORIES` | 46 | 2 YouTube categories |
| `youtube.py` | `FOOD_CATEGORIES` | 47 | 2 YouTube categories |

### Already Externalized (in `prompts/`)

- `section_summary.txt` - Uses `{persona_guidelines}` and `{variant_examples}` placeholders
- `section_detect.txt`
- `concept_extract.txt`
- `global_synthesis.txt`
- `quick_synthesis.txt`
- `metadata_tldr.txt`
- `description_analysis.txt`

### Key Dependencies

1. `llm.py:summarize_section()` uses `PERSONA_GUIDELINES` and `VARIANT_EXAMPLES`
2. `llm.py:stream_summarize_section()` uses same dictionaries
3. `youtube.py:_determine_persona()` uses all keyword/category sets
4. Tests in `test_llm_service.py` don't test persona loading (opportunity to add)

---

## Proposed Future State

### New Directory Structure

```
prompts/
├── personas/
│   ├── code.txt           # Guidelines for code persona
│   ├── recipe.txt         # Guidelines for recipe persona
│   ├── interview.txt      # Guidelines for interview persona
│   ├── review.txt         # Guidelines for review persona
│   └── standard.txt       # Guidelines for standard persona (default)
├── examples/
│   ├── code.txt           # JSON examples for code persona
│   ├── recipe.txt         # JSON examples for recipe persona
│   ├── interview.txt      # JSON examples for interview persona
│   ├── review.txt         # JSON examples for review persona
│   └── standard.txt       # JSON examples for standard persona
├── detection/
│   └── persona_rules.json # Keywords + categories for persona detection
├── section_summary.txt    # (existing)
├── section_detect.txt     # (existing)
├── concept_extract.txt    # (existing)
├── global_synthesis.txt   # (existing)
├── quick_synthesis.txt    # (existing)
├── metadata_tldr.txt      # (existing)
└── description_analysis.txt # (existing)
```

### Code Changes

**`llm.py`:**
- Add `PERSONAS_DIR` and `EXAMPLES_DIR` path constants
- Add `load_persona(name: str) -> str` function
- Add `load_examples(name: str) -> str` function
- Remove `PERSONA_GUIDELINES` dictionary (lines 20-54)
- Remove `VARIANT_EXAMPLES` dictionary (lines 57-79)
- Update `summarize_section()` to use new loaders
- Update `stream_summarize_section()` to use new loaders

**`youtube.py`:**
- Add `_load_persona_rules() -> dict` function
- Remove `CODE_KEYWORDS` set (lines 32-37)
- Remove `FOOD_KEYWORDS` set (lines 39-43)
- Remove `TECH_CATEGORIES` set (line 46)
- Remove `FOOD_CATEGORIES` set (line 47)
- Update `_determine_persona()` to load from JSON

---

## Implementation Phases

### Phase 1: Create Prompt Files (Low Risk)

Create new files without modifying any existing code. Files can be tested manually before integration.

**Tasks:**
1. Create `prompts/personas/` directory
2. Create 5 persona guideline files (extract from `PERSONA_GUIDELINES`)
3. Create `prompts/examples/` directory
4. Create 5 example files (extract from `VARIANT_EXAMPLES`)
5. Create `prompts/detection/` directory
6. Create `persona_rules.json` (extract from `youtube.py` constants)

### Phase 2: Update `llm.py` (Medium Risk)

Modify `llm.py` to use new file-based loaders.

**Tasks:**
1. Add `PERSONAS_DIR` and `EXAMPLES_DIR` path constants
2. Add `load_persona()` function with fallback to standard
3. Add `load_examples()` function with fallback to standard
4. Update `summarize_section()` to use new loaders
5. Update `stream_summarize_section()` to use new loaders
6. Remove `PERSONA_GUIDELINES` and `VARIANT_EXAMPLES` dictionaries
7. Verify syntax with `python -m py_compile`

### Phase 3: Update `youtube.py` (Medium Risk)

Modify `youtube.py` to load detection rules from JSON.

**Tasks:**
1. Add `_load_persona_rules()` function
2. Update `_determine_persona()` to use JSON rules
3. Remove `CODE_KEYWORDS`, `FOOD_KEYWORDS`, `TECH_CATEGORIES`, `FOOD_CATEGORIES`
4. Verify syntax with `python -m py_compile`

### Phase 4: Testing & Verification (Critical)

Ensure all changes work correctly.

**Tasks:**
1. Run existing tests: `cd services/summarizer && pytest`
2. Add tests for new loader functions
3. Manual test: Process a code video, verify persona detection
4. Manual test: Process a cooking video, verify persona detection
5. Verify SSE streaming still works with new loaders

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File not found at runtime | Low | High | Fallback to standard persona in loaders |
| JSON parse error in persona_rules.json | Low | High | Add validation on startup |
| Wrong encoding in text files | Low | Medium | Use UTF-8 explicitly |
| Performance regression (file I/O) | Very Low | Low | Files are small (<2KB), loaded once per request |
| Test failures | Medium | Medium | Run tests after each phase |

---

## Success Metrics

1. **Zero hardcoded LLM context** in Python files
2. **All existing tests pass** without modification
3. **Persona detection works** for code and recipe videos
4. **Streaming still works** with new file-based loaders
5. **Clear organization** in prompts/ folder

---

## Required Resources

- **Files to modify:** 2 (`llm.py`, `youtube.py`)
- **Files to create:** 11 (5 personas + 5 examples + 1 JSON)
- **Directories to create:** 3 (`personas/`, `examples/`, `detection/`)
- **Dependencies:** None (using built-in Python)

---

## Timeline Estimates

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Create Files | S | None |
| Phase 2: Update llm.py | M | Phase 1 |
| Phase 3: Update youtube.py | S | Phase 1 |
| Phase 4: Testing | S | Phases 2, 3 |

**Total Estimated Effort:** Medium (M)

---

## Rollback Plan

1. Revert changes to `llm.py` and `youtube.py`
2. Keep new prompt files (they don't affect anything if not used)
3. Git history preserves all original code
