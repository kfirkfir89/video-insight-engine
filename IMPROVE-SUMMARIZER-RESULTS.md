# Summarizer Improvements: Per-Chapter Views + Inline Concept Tooltips

## Context

A food vlog video (Mexican restaurant review http://localhost:5173/video/698b0360beb5044a9c0c98b1 youtube: https://www.youtube.com/watch?v=jrAJaI-CbQ0) was summarized and categorized globally as "reviews". This caused ALL chapters to render with the ReviewView, even chapters that are clearly cooking/recipe content (e.g., "Short Ribs" got `rating` blocks instead of `ingredient`/`step` blocks). Additionally, extracted concepts (Penca de Maguey, Enmoladas, Queso Fundido, etc.) appear only in a small sidebar - they're never shown inline within the content blocks where they're mentioned.

**Goal**: Make summaries more dynamic by (1) allowing each chapter to independently select the best view for its content, and (2) embedding concept definitions as interactive inline tooltips within content text.

---

## Part 1: Per-Chapter View Detection

### Problem

One global category ("reviews") → one persona → all chapters get review-biased blocks → one ReviewView for everything.

### Solution: Dual-Persona Architecture (Author + Domain Expert per chapter)

**Key insight**: Rich, deeply characterized personas produce far better LLM output than generic instructions. Current personas are thin ("You are a friendly chef" + block rules). The new system uses a **reporter + expert consultant** model:

- **Author persona** (always primary): Like a skilled journalist or documentary narrator. They're the main writer who shapes the narrative, knows how to engage readers, and chooses the right content structure. Their voice stays consistent across the entire article.
- **Domain Expert consultants** (one selected per chapter): Like a professional brought on to a news segment. The Author "consults" with the right expert to ensure domain accuracy, authentic terminology, and insider knowledge. The Author doesn't become the chef - they collaborate with the chef to write about the dish authentically.

This mirrors real-world content creation: a food documentary narrator interviews a chef, a tech journalist consults engineers, a travel magazine writer talks to local guides. The narrative voice stays consistent, but the expertise comes through.

**Summarizer changes:**

1. **Modify prompt** (`services/summarizer/src/prompts/chapter_summary.txt`)
   - Replace `{persona_guidelines}` with `{persona_system}`
   - Keep `{variant_examples}` — see step 2 below for how examples are selected
   - Add `"view"` field to expected JSON output
   - The `{persona_system}` contains BOTH the base author + ALL domain expert descriptions
   - LLM reads the chapter content, selects the best domain expert, writes in that combined voice

2. **Create new persona system file** (`prompts/persona_system.txt`)

   ```
   YOU ARE THE AUTHOR.
   A veteran content creator and storyteller with 15+ years turning complex topics
   into engaging, scannable articles. You shape the narrative, you choose the
   structure, you decide what the reader needs to know. Your voice is consistent,
   clear, and authoritative. Every sentence earns its place.

   But you don't work alone. For each chapter, you bring in the right EXPERT
   CONSULTANT - a specialist whose deep domain knowledge makes your writing
   authentic and precise. Think of it like a documentary: you're the narrator,
   and the expert is the professional you interview to get the real story.

   EXPERT CONSULTANTS (bring in the ONE who best fits THIS chapter's content):

   CHEF (cooking/recipe content) — view: "cooking"
   30 years in kitchens, from Oaxacan abuelas to Michelin restaurants. Knows WHY
   each technique works, not just the steps. Shares the tips that took decades to
   learn. When you consult the Chef, your writing gains authentic culinary
   terminology, precise measurements, and insider technique insights.
   → Preferred blocks: ingredient, step, nutrition, tool_list, keyvalue(info), callout(chef_tip)

   TRAVELER (travel/destination content) — view: "travel"
   40+ years across every continent. Notices what guidebooks miss — hidden spots,
   local customs, practical realities of getting around. When you consult the
   Traveler, your writing gains real logistics, honest assessments, and the kind
   of insider knowledge that makes readers feel like they have a local friend.
   → Preferred blocks: location, itinerary, cost, callout(tip/warning)

   CRITIC (review/evaluation content) — view: "reviews"
   Thousands of products, restaurants, and experiences evaluated. Balances
   subjective impression with objective criteria. Always fair, always honest.
   When you consult the Critic, your writing gains structured evaluation, clear
   criteria, and the "who is this for" framing that readers trust.
   → Preferred blocks: pro_con, rating, verdict, cost, comparison, statistic

   ENGINEER (coding/technical content) — view: "coding"
   Principal engineer, 20+ years across startups and big tech. Explains by
   showing real code, not hand-waving. Knows the tradeoffs. When you consult
   the Engineer, your writing gains actual code examples, correct terminology,
   and the nuance that separates tutorials from real engineering guidance.
   → Preferred blocks: code, terminal, file_tree, comparison(dos_donts), callout(security)

   PROFESSOR (educational content) — view: "education"
   Master teacher who makes complex ideas click. Builds from simple to complex,
   uses analogies that stick. When you consult the Professor, your writing gains
   pedagogical structure and knowledge-check moments.
   → Preferred blocks: definition, formula, quiz, timeline, callout(note)

   TRAINER (fitness content) — view: "fitness"
   Certified trainer, 15+ years coaching all levels. Focuses on proper form,
   progressive overload, injury prevention. When you consult the Trainer, your
   writing gains precise exercise descriptions and safety awareness.
   → Preferred blocks: exercise, workout_timer, callout(warning)

   HOST (podcast/interview content) — view: "podcast"
   Veteran interviewer who draws out the best stories. Knows which quotes deserve
   the spotlight and what context readers need. When you consult the Host, your
   writing captures the most compelling moments and gives them proper framing.
   → Preferred blocks: guest, quote(speaker), transcript, timestamp

   MAKER (DIY/crafts/how-to content) — view: "diy"
   Lifelong builder and maker. Woodworking, electronics, home repair — if it
   involves tools and materials, they've done it. Thinks in terms of materials,
   tolerances, and "measure twice, cut once." When you consult the Maker, your
   writing gains practical build steps, material lists, and safety-first awareness.
   → Preferred blocks: tool_list, step, callout(warning), keyvalue(info), numbered

   GAMER (gaming content) — view: "gaming"
   Veteran gamer and analyst across genres. Understands mechanics, meta, and what
   makes gameplay satisfying. When you consult the Gamer, your writing gains
   precise gameplay terminology, strategic framing, and community-aware context.
   → Preferred blocks: comparison, rating, statistic, callout(tip), keyvalue(specs)

   ANALYST (general/standard content) — view: "standard"
   Clear thinker who distills information to its essence. Finds structure in
   unstructured content. Your default consultant when no specialist fits.
   → Preferred blocks: paragraph, bullets, numbered, callout, definition, keyvalue

   INSTRUCTIONS:
   1. Read the chapter content
   2. Select the expert consultant whose domain best matches THIS chapter
   3. Write as the Author, informed by that expert's knowledge and perspective
   4. Use the expert's preferred blocks when appropriate
   5. Output "view" = the expert's view value (cooking|coding|reviews|travel|fitness|education|podcast|diy|gaming|standard)
   ```

3. **Modify `summarize_chapter()` AND `stream_summarize_chapter()`** (`services/summarizer/src/services/llm.py`)

   Both the non-streaming path (line 316) and streaming path (line 562) must get the same changes. Also update `process_video()` (line 412) which calls `summarize_chapter()` directly.

   - Remove `persona` parameter (or make optional for backward compat)
   - Load `persona_system.txt` (cached via `@lru_cache`, loaded once) instead of individual persona file
   - **Keep `{variant_examples}`**: Still load the per-persona examples file, but select which one based on the *global* category as a hint. The LLM picks the expert, but the examples give it concrete output patterns. This prevents quality regression from losing the detailed per-persona JSON examples.
   - Extract `view` from LLM response
   - Add `_infer_view_from_blocks()` deterministic validator:
     ```python
     VIEW_SIGNATURE_BLOCKS = {
         'cooking': {'ingredient', 'step', 'nutrition'},
         'coding': {'code', 'terminal', 'file_tree'},
         'reviews': {'pro_con', 'rating', 'verdict'},
         'travel': {'location', 'itinerary'},
         'fitness': {'exercise', 'workout_timer'},
         'education': {'quiz', 'formula'},
         'podcast': {'guest'},
         'diy': {'tool_list', 'step'},
         'gaming': set(),  # No unique signature blocks — relies on LLM
     }
     ```
   - **View resolution rule (soft correction, not hard override)**:
     1. LLM-stated view is the **primary** signal.
     2. Block inference is a **correction** only when there is **strong evidence**: 2+ distinct signature blocks matching a single view. A single signature block is not enough to override (e.g., one `rating` block in an otherwise cooking chapter shouldn't force `reviews`).
     3. When correction triggers, log a warning: `logger.warning(f"View corrected: LLM said '{llm_view}', blocks strongly suggest '{inferred_view}' (matched {matched_count} signature blocks). Using inferred.")`
     4. If block inference has no strong match AND LLM stated a valid view, use LLM view.
     5. If LLM stated no view or an invalid value, fall back to `"standard"`.

     This avoids the brittleness of purely block-driven inference (e.g., a cooking chapter about "the history of mole" has no ingredient/step blocks but is still best rendered in cooking view).

   - **Persona-to-view name mapping**: Add a mapping constant for the transition from old persona names to new view names. This keeps `load_examples()`, `_log_block_metrics()`, and `generate_master_summary()` working:
     ```python
     PERSONA_TO_VIEW: dict[str, str] = {
         'recipe': 'cooking',
         'code': 'coding',
         'review': 'reviews',
         'interview': 'podcast',
         'standard': 'standard',
         'travel': 'travel',
         'fitness': 'fitness',
         'education': 'education',
     }
     ```
     The old persona files and examples files continue to work — they're loaded by persona name but the view name is what gets stored and sent to the frontend.

4. **Modify stream route** (`services/summarizer/src/routes/stream.py`)
   - `build_chapter_dict()` (line 372): Include `"view"` field from `summary_data`
   - `process_creator_chapters()` (line 408): Remove `persona=persona` from `summarize_chapter()` calls
   - `process_ai_chapters()` (line 487): Remove `persona=persona` from `summarize_chapter()` calls
   - `run_parallel_analysis()` (line 286): Remove `persona=persona` from `summarize_chapter()` call for first chapter
   - Keep global persona only for `generate_master_summary()` (it still uses persona for the overall narrative voice)

**Token cost**: The persona system is realistically ~600-750 tokens (the full text with all 10 expert descriptions including DIY and Gaming). This replaces the current per-persona injection (~100 tokens) but keeps `{variant_examples}` (unchanged). Net increase is ~500-650 tokens per chapter. For a typical 5-chapter video this adds ~2,500-3,250 tokens total — still modest, but worth noting for videos with 10+ chapters. Monitor actual usage after rollout.

**Type changes:**

5. **Add `view` to SummaryChapter** (`packages/types/src/index.ts`)
   ```typescript
   view?: VideoCategory;  // Per-chapter view (optional, falls back to global category)
   ```

**Frontend changes:**

6. **Use per-chapter view** (`apps/web/src/components/video-detail/ArticleSection.tsx:74`)
   ```typescript
   const effectiveCategory = chapter.view ?? category ?? "standard";
   ```

   - One-line change - swap `category` for `effectiveCategory` in the switch

**Backward compat**: `view` is optional. Old summaries without it fall back to global `category`. No migration needed.

---

## Part 2: Inline Concept Tooltips

### Problem

Concepts are extracted but only shown in a tiny sidebar. When "Penca de Maguey" appears in a paragraph block, there's no way to see what it means without scrolling to the sidebar.

### Solution: ConceptHighlighter component with React Context

**New components:**

1. **`ConceptsContext.tsx`** (`apps/web/src/components/video-detail/ConceptsContext.tsx`)
   - React Context to pass concepts deep into the block tree without props drilling
   - `ConceptsProvider` wraps the category view in `ArticleSection`
   - `useConcepts()` hook consumed by `ConceptHighlighter`

2. **`ConceptHighlighter.tsx`** (`apps/web/src/components/video-detail/ConceptHighlighter.tsx`)
   - Takes `text: string` prop
   - Internally calls `useConcepts()` to get concept list
   - **Memoize the compiled regex** with `useMemo` keyed on the concept list (concepts are stable per-video, so this caches effectively). Do NOT rebuild the regex on every render:
     ```typescript
     const { regex, conceptMap } = useMemo(() => {
       if (!concepts.length) return { regex: null, conceptMap: new Map() };
       const map = new Map(concepts.map(c => [c.name.toLowerCase(), c]));
       const escaped = concepts
         .map(c => c.name)
         .sort((a, b) => b.length - a.length) // longest first
         .map(name => escapeRegex(name));
       return {
         regex: new RegExp(`(?<=^|[\\s.,;:!?"""'(\\[])(?:${escaped.join('|')})(?=[\\s.,;:!?"""')\\]]|$)`, 'gi'),
         conceptMap: map,
       };
     }, [concepts]);
     ```
   - **Regex safety**: Escape all special regex characters in concept names before building the pattern (use a helper like `escapeRegex(str)` that escapes `.[]*+?{}()|\^$`). This prevents breakage from concept names containing parentheses, periods, etc. (e.g., "Café (Traditional)" or "Dr. Pepper").
   - **Word boundary strategy**: Use **lookahead/lookbehind for whitespace and punctuation** instead of `\b`. The `\b` metacharacter doesn't work reliably with accented characters or non-Latin scripts (e.g., "Café", "Pão de Queijo"). Use `(?<=^|[\s.,;:])` and `(?=[\s.,;:]|$)` pattern shown above.
   - Splits text into plain + matched segments via `regex.exec()` loop or `String.prototype.split()` with capture group
   - Matched terms render as clickable `<Popover>` triggers with dotted underline
   - Popover shows: concept name (bold) + definition + optional timestamp link
   - Uses Radix Popover (click-based, works on mobile)
   - **Popover congestion**: When multiple concept triggers appear close together, only allow one popover open at a time. Track `openConceptId` in state and close the previous when a new one opens. This prevents visual collision between adjacent popovers.
   - **Mobile dismissal**: Ensure popover has proper `onInteractOutside` handling and doesn't obscure adjacent content. Use `collisionPadding` and `avoidCollisions` props on Radix Popover Content to prevent overflow issues. Test on real mobile device early (Phase C, not just verification).

**Integration into blocks** (replace raw text rendering with `<ConceptHighlighter text={...} />`):

3. **`ContentBlockRenderer.tsx`** - This is the highest-impact integration point. For `paragraph` blocks, replace the direct `{block.text}` render with `<ConceptHighlighter text={block.text} />`. Also apply to `definition` block's `meaning` field rendered inline here. Do NOT apply to `code`, `terminal`, `formula`, `ingredient`, `step`, `exercise` blocks rendered by this component — these contain structured/code content where concept highlighting would be noise.
4. **`CalloutBlock.tsx`** - Replace `{block.text}` with `<ConceptHighlighter text={block.text} />`
5. **`QuoteRenderer.tsx`** - Replace `{block.text}` with `<ConceptHighlighter text={block.text} />`
6. **`DefinitionBlock.tsx`** - Replace `{block.meaning}` with `<ConceptHighlighter text={block.meaning} />`

**Exclusion list** (blocks that should NOT get highlighting): `code`, `terminal`, `formula`, `ingredient`, `step`, `exercise`, `workout_timer`, `file_tree` (structured/code/data content where inline tooltips would be disruptive).

**Keep sidebar concepts** as secondary reference/index alongside inline tooltips. (Confirmed: both sidebar + inline tooltips coexist.)

---

## Implementation Sequence

| Phase                               | Scope                                                             | Files                                                                                | Deploy             |
| ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| A: Backend per-chapter view         | Persona system + prompt + LLM service (both paths) + stream route | `persona_system.txt` (new), `chapter_summary.txt`, `llm.py`, `stream.py`             | Independent        |
| B: Type + frontend per-chapter view | Types + ArticleSection                                            | `index.ts`, `ArticleSection.tsx`                                                     | After A            |
| C: Concept tooltips                 | New components + block integration                                | `ConceptsContext.tsx`, `ConceptHighlighter.tsx`, 4 block files, `ArticleSection.tsx` | Independent of A/B |

---

## Critical Files

| File                                                              | Change                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `services/summarizer/src/prompts/chapter_summary.txt`             | Replace `{persona_guidelines}` with `{persona_system}`, keep `{variant_examples}`, add `"view"` output |
| `services/summarizer/src/prompts/persona_system.txt`              | **NEW** - Dual-persona system (Author + 10 Domain Experts including DIY/Gaming)                  |
| `services/summarizer/src/services/llm.py`                         | Update `summarize_chapter()` + `stream_summarize_chapter()` + `process_video()`: load persona_system, add `PERSONA_TO_VIEW` mapping, add `_infer_view_from_blocks()` with soft correction (2+ blocks threshold), extract view |
| `services/summarizer/src/routes/stream.py`                        | Include `view` in chapter dict, remove `persona=` from all `summarize_chapter()` calls           |
| `packages/types/src/index.ts`                                     | Add `view?: VideoCategory` to `SummaryChapter`                                                   |
| `apps/web/src/components/video-detail/ArticleSection.tsx`         | Use `chapter.view ?? category`, wrap with `ConceptsProvider`                                     |
| `apps/web/src/components/video-detail/ConceptHighlighter.tsx`     | **NEW** - Inline concept tooltip component                                                       |
| `apps/web/src/components/video-detail/ConceptsContext.tsx`        | **NEW** - React context for concepts                                                             |
| `apps/web/src/components/video-detail/blocks/CalloutBlock.tsx`    | Integrate ConceptHighlighter                                                                     |
| `apps/web/src/components/video-detail/blocks/QuoteRenderer.tsx`   | Integrate ConceptHighlighter                                                                     |
| `apps/web/src/components/video-detail/blocks/DefinitionBlock.tsx` | Integrate ConceptHighlighter                                                                     |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx`   | Integrate ConceptHighlighter in paragraph                                                        |

---

## Verification

1. **Re-summarize the Mexican food video** and verify:
   - "Meet the Chef" chapter → standard/interview view with quote blocks
   - "Short Ribs" / "chiladas de mole" chapters → cooking view with ingredient/step blocks
   - "Lets eat" chapter → review view with pro_con/verdict blocks
2. **Check concept tooltips**: Click "Penca de Maguey" in a paragraph → popover shows definition
3. **Backward compat**: Load an old cached summary → still renders with global category view
4. **Mobile**: Verify popover tooltips work on touch (click-based, not hover) — test early during Phase C development, not just at the end
5. **Run existing tests** to ensure no regressions
6. **Check view mismatch logs**: After re-summarizing, check for any `View mismatch` warnings in logs. Frequent mismatches indicate the persona prompt needs tuning.

---

## Claude Code Instructions

Save this file as `docs/plan-per-chapter-views.md` in your repo, then run three separate Claude Code sessions:

**Phase A (backend):**

> Read `docs/plan-per-chapter-views.md`. Implement Phase A only: create `persona_system.txt` with all 10 experts (including DIY and Gaming), modify `chapter_summary.txt` to replace `{persona_guidelines}` with `{persona_system}` (keep `{variant_examples}`) and add `"view"` to expected JSON output. Modify `llm.py`: add `PERSONA_TO_VIEW` mapping, update BOTH `summarize_chapter()` and `stream_summarize_chapter()` to load persona_system and extract view, add `_infer_view_from_blocks()` with soft correction (only override LLM when 2+ signature blocks match). Update `process_video()` as well. Modify `stream.py` to include view in chapter dict and remove `persona=` from all `summarize_chapter()` calls.

**Phase B (types + frontend view):**

> Read `docs/plan-per-chapter-views.md`. Implement Phase B: add `view?: VideoCategory` to `SummaryChapter` in `packages/types/src/index.ts`, and update `ArticleSection.tsx` to use `chapter.view ?? category ?? "standard"`.

**Phase C (concept tooltips):**

> Read `docs/plan-per-chapter-views.md`. Implement Phase C: create `ConceptsContext.tsx` and `ConceptHighlighter.tsx`. Memoize the compiled regex with `useMemo` keyed on concepts list. Use lookahead/lookbehind for whitespace/punctuation instead of `\b` for non-English concept name support. Escape regex special characters. Track `openConceptId` state to allow only one popover open at a time. Integrate ConceptHighlighter into paragraph blocks (ContentBlockRenderer), CalloutBlock, QuoteRenderer, and DefinitionBlock. Skip highlighting in code/terminal/formula/ingredient/step/exercise/workout_timer/file_tree blocks. Wrap the category view in ArticleSection with ConceptsProvider. Use Radix Popover with `collisionPadding` and `avoidCollisions` for mobile-safe positioning.
