# Output Quality Fix — Tab Mismatches + Weak Extraction Prompts

Last Updated: 2026-03-09

## Executive Summary

The structured output system is broken for 9 of 10 output types. Two root causes:
1. **Tab ID mismatches**: `intent_detector.py` sends section IDs that don't match frontend `*Tabs.tsx` switch/case values → tabs render blank
2. **Weak extraction prompts**: Old persona system (451-line prompts, 33 typed blocks, per-category personas) was replaced by ~50-line prompts with just JSON schema → LLM returns empty arrays

## Current State

- `_TYPE_SECTIONS` in `intent_detector.py` has wrong tab IDs for 9/10 output types
- Only `recipe` tabs work correctly
- Extraction prompts lack: per-field guidance, mandatory minimums, quality examples, domain context
- Cached results also serve stale tab IDs
- Example: `code_walkthrough` sends `[overview, code, concepts, takeaways]` but CodeTabs.tsx handles `[overview, setup, code, patterns, cheat_sheet]`

## Proposed Future State

- All 10 output types render correctly with matching tab IDs
- Extraction prompts produce rich, populated data (no empty arrays)
- Cached results auto-fix to canonical sections
- Regression test prevents future tab ID drift

## Implementation Phases

### Phase 1: Fix Tab Rendering (Steps 1-2) — Priority: CRITICAL
Fix `_TYPE_SECTIONS` and cached path. This unblocks all tab rendering.

### Phase 2: Rewrite Extraction Prompts (Step 3) — Priority: HIGH
Rewrite all 10 extract_*.txt prompts with rich guidance, mandatory minimums, quality examples, and domain-specific context ported from old persona files.

### Phase 3: Tests + Verification (Step 4) — Priority: MEDIUM
Update tests, add alignment test, run full verification.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prompt changes increase token usage | Medium | Low | Keep prompts under 200 lines; the old system was 451+ |
| LLM still returns sparse data | Low | Medium | Mandatory minimums + enforcement language |
| Cached results have stale data beyond sections | Low | Low | Re-apply canonical sections at read time |
| Frontend *Tabs.tsx have bugs with new data | Low | Medium | E2E test with real video after changes |

## Success Metrics

- All 10 output types render populated tabs (no blank/null tabs)
- Code walkthrough: snippets >= 3, patterns >= 2, cheatSheet >= 3
- All existing tests pass
- New alignment test prevents future tab ID drift
