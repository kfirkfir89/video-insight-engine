# Block Output Quality V3 — Push to 9+/10

Last Updated: 2026-02-24 (COMPLETE)

## Executive Summary

Quality analysis of real video summaries scored **6.5/10**. This plan addresses 6 specific failures through 3 implementation batches, all touching the summarizer service. Goal: reach **9+/10** across block variety, attribution accuracy, view correctness, and structural diversity.

## Current State

| Problem | Metric | Root Cause |
|---------|--------|------------|
| Callout overuse | 73% of chapters end with callout | No cross-chapter enforcement |
| View misassignment | Podcast gets 68% "coding" views | Threshold too high (requires 2+ signature blocks; podcast only has `guest`) |
| Quote attributions | 89% use placeholder names | No guest name injection into prompt |
| Structural repetition | paragraph→quote→comparison→callout dominates | No diversity instruction or post-gen enforcement |
| No images | Visual blocks have empty `imageUrl` | Backend never populates the field |
| Redundant generatedTitle | Always generated, even for descriptive titles | `has_creator_title=True` hardcoded, no vagueness check |

## Proposed Future State

- Cross-chapter state tracking (guest names, previous block types) flows between chapter calls
- Post-generation enforcer trims excess callouts/comparisons, fixes generic attributions
- View resolution uses per-view signature thresholds + category-aware fallback
- Visual blocks auto-populated with YouTube thumbnail
- `generatedTitle` only for vague/short titles ("Intro", "Part 1", etc.)
- Anti-repetition rules in prompt + enforcement in code

---

## Implementation

### Batch 1: Cross-Chapter State + Anti-Repetition (Priority: Critical)

All changes touch the same 3 files. Implement together.

**Files:**
- `services/summarizer/src/services/llm.py`
- `services/summarizer/src/routes/stream.py`
- `services/summarizer/src/prompts/chapter_summary.txt`

#### 1.1 Quote Attribution Fix

**stream.py** — Extract guest names from first chapter's `guest` blocks:
- In `process_creator_chapters()` after first chapter completes: scan content for blocks with `type == "guest"`, extract names into `guest_names: list[str]`
- Pass `guest_names` to every subsequent `summarize_chapter()` call
- Same pattern for `process_ai_chapters()`

**llm.py** — `summarize_chapter()`:
- Add param: `guest_names: list[str] | None = None`
- Build prompt injection when present:
  ```
  SPEAKER ATTRIBUTION (CRITICAL):
  Guests in this video: {names}
  - MUST use actual name in quote attribution
  - NEVER use "Expert Name", "Speaker", "Engineer", "Host"
  - If unsure who spoke, use "highlight" variant (no attribution)
  ```
- Inject via `{guest_attribution}` placeholder in chapter_summary.txt

**chapter_summary.txt**:
- Fix line 92: change example `"attribution": "Expert Name"` → `"attribution": "Andrej Karpathy"`
- Add `{guest_attribution}` placeholder after `{fact_sheet}` (around line 430)
- Add to SELF-CHECK: `8. ATTRIBUTION: Every quote must use a real person's name.`

#### 1.2 Post-Generation Block Diversity Enforcer

**llm.py** — New function + constants:

```python
CALLOUT_MAX_PER_CHAPTER = 1
COMPARISON_MAX_PER_CHAPTER = 1
GENERIC_ATTRIBUTIONS = frozenset([
    "expert name", "speaker", "engineer", "host", "expert",
    "the speaker", "the host", "interviewee", "presenter",
    "expert speaker", "engineering lead",
])
```

New `_enforce_block_diversity(content, title, prev_block_types)`:
1. Trim callouts beyond limit (keep first, drop rest from end)
2. Trim comparisons beyond limit (keep first)
3. If last block == callout AND previous chapter also ended with callout → remove it
4. Replace generic quote attributions → switch to "highlight" variant, drop attribution

Wire between content parsing (line ~1048) and `inject_block_ids()` (line ~1067).

#### 1.3 Cross-Chapter Diversity Prompt Injection

**llm.py** — `summarize_chapter()`:
- Add param: `prev_chapter_block_types: list[str] | None = None`
- Build dynamic injection:
  ```
  BLOCK DIVERSITY ENFORCEMENT:
  Previous chapter used: [{types}]
  - Use at least 1 block type NOT in above list
  - Do NOT end with same block type as previous chapter
  - If previous used comparison, prefer problem_solution/definition/bullets instead
  ```
- Add `{diversity_instruction}` placeholder after BLOCK COUNT GUIDELINES (line ~323)

**stream.py**:
- Track `prev_block_types: list[str] | None = None` in both process functions
- After each chapter: `prev_block_types = [b.get("type") for b in content]`
- Pass to next `summarize_chapter()` call

#### 1.4 View Misassignment Fix

**llm.py**:

A. Lower podcast threshold in `_infer_view_from_blocks()`:
```python
VIEW_SIGNATURE_THRESHOLD: dict[str, int] = {'podcast': 1}
DEFAULT_THRESHOLD = 2
```
Use per-view threshold instead of hardcoded `>= 2`.

B. Add category-aware fallback to `_resolve_view()`:
- Add param: `category: str | None = None`
- When LLM view doesn't match category and has no signature blocks → use category view
- Map: `{'recipe': 'cooking', 'code': 'coding', 'interview': 'podcast', ...}`

C. Thread persona-derived category through `summarize_chapter()` → `_resolve_view()`.

#### 1.5 Prompt Anti-Repetition Rules

**chapter_summary.txt** — New section after callout quality gate:

```
ANTI-REPETITION RULES:
- Maximum 1 callout per chapter. Second callout → convert to paragraph or delete.
- Maximum 1 comparison per chapter unless genuinely 3+ comparisons exist.
- Do NOT end consecutive chapters with the same block type.
- Each chapter MUST include at least 1 block type different from {paragraph, quote, comparison, callout}.
  Underused alternatives: definition, statistic, keyvalue, timestamp, problem_solution, visual, bullets, timeline.
- Avoid the dominant pattern: paragraph → quote → comparison → callout. Vary structure.
```

Add callout style variety instruction to callout block definition:
```
Style variety: Do NOT default to "tip". Match the content:
- "tip" → genuinely useful pro tips only
- "warning" → pitfalls, common mistakes, things that go wrong
- "note" → context, background, clarifications
If 70%+ of callouts are "tip", rethink.
```

### Batch 2: Visual Block Images (Priority: Medium)

#### 2.1 Backend: Populate imageUrl with YouTube thumbnail

**stream.py** — New helper:
```python
def _populate_visual_images(content: list[dict], youtube_id: str) -> list[dict]:
    for block in content:
        if block.get("type") == "visual" and not block.get("imageUrl"):
            block["imageUrl"] = f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg"
    return content
```

Call in `build_chapter_dict()` — add `youtube_id` param, apply before returning.
Thread `youtube_id` from `ctx.youtube_id` through both process functions.

#### 2.2 Frontend: VisualBlock fallback (optional)

`VisualBlock.tsx` already renders `<img>` when `imageUrl` is present. No frontend change required if backend populates correctly.

### Batch 3: Conditional generatedTitle (Priority: Low)

**llm.py** — New function:
```python
_VAGUE_TITLE_RE = re.compile(
    r'^(intro|outro|part\s+\d+|chapter\s+\d+|section\s+\d+|'
    r'wrap.?up|conclusion|bonus|q\s*&?\s*a|final\s+thoughts|'
    r'closing|opening|welcome|preface)$', re.IGNORECASE,
)

def _title_needs_subtitle(title: str) -> bool:
    if not title.strip():
        return True
    if _VAGUE_TITLE_RE.match(title.strip()):
        return True
    return len(title.split()) < 4
```

**stream.py**:
- Replace `has_creator_title=True` with `has_creator_title=_title_needs_subtitle(ch.title)` at lines ~543 and ~784.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prompt changes degrade existing quality | High | Run before/after on 3 test videos |
| `_enforce_block_diversity` removes important content | Medium | Only trim duplicates, never remove last remaining block |
| View threshold change (podcast=1) too aggressive | Low | Single `guest` block is strong signal; other views still need 2 |
| YouTube thumbnail not available for all videos | Low | Graceful degradation — `imageUrl` stays empty if no YouTube ID |

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Callouts ending chapters | 73% | <30% |
| View correctness | ~60% | >90% |
| Real name attributions | 11% | >85% |
| Block type diversity (unique types/chapter) | ~3 | >4.5 |
| Chapters with imageUrl on visual blocks | 0% | 100% |
| Redundant generatedTitle | 100% | <20% (only on vague titles) |

## Verification

1. **Unit tests**: `_enforce_block_diversity()`, `_title_needs_subtitle()`, updated `_infer_view_from_blocks()` with per-view thresholds
2. **Integration test**: Re-summarize Boris Cherny podcast → verify quote attributions, max 1 callout/chapter, no consecutive same-ending blocks, views = "podcast"
3. **Cooking video test**: Re-summarize carbonara video → verify visual blocks have `imageUrl`
4. **Regression**: `cd services/summarizer && python -m pytest`

---

## COMPLETION STATUS

**All batches COMPLETE. All verification items PASSED.**

- 77 tests written and passing (52 unit + 25 integration)
- 545 existing tests still passing
- Playwright layout audits passed at all breakpoints
- Extensions completed: persona accuracy rules, new block types, layout engine enhancements, spacing tightening

**All changes are UNCOMMITTED on branch `dev-0`** on top of commit `ed62051`. See `block-output-quality-v3-context.md` for full file list and handoff notes.
