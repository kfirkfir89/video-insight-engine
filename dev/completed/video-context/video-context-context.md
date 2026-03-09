# Video Context Enhancement - Context File

**Last Updated:** 2026-01-21 (Session 3)

---

## Session Summary (2026-01-21 - Session 3)

### Discovery: Backend Phases 1-3 Already Implemented!

When reviewing code to implement the plan, discovered that **all backend phases (1-3) were already fully implemented**. The task list was outdated.

### Evidence Found

| Phase | Component | Location |
|-------|-----------|----------|
| 1 | `VideoContext` dataclass | `youtube.py:64-79` |
| 1 | `_determine_persona()` | `youtube.py:96-136` |
| 1 | `_build_display_tags()` | `youtube.py:139-179` |
| 1 | `extract_video_context()` | `youtube.py:182-221` |
| 1 | yt-dlp extracts categories/tags | `youtube.py:526-528` |
| 2 | `summarize_section(persona=)` | `llm.py:284-345` |
| 2 | `load_persona()` with LRU cache | `llm.py:38-60` |
| 2 | `load_examples()` with LRU cache | `llm.py:63-85` |
| 2 | 5 persona files | `prompts/personas/*.txt` |
| 2 | 5 example files | `prompts/examples/*.txt` |
| 2 | Detection rules | `prompts/detection/persona_rules.json` |
| 3 | Context in SSE metadata | `stream.py:106-125` |
| 3 | Persona passed to LLM | `stream.py:232-238` |
| 3 | Context saved to MongoDB | `stream.py:488-490` |

### Work Completed This Session

1. **Verified implementation** - Read and confirmed all backend files
2. **Updated task documentation** - Marked Phases 1-3 as complete with line references
3. **Updated this context file** - Documented the discovery

### Remaining Work

- Run verification tests with real videos to confirm end-to-end flow
- Optional: Fix TimestampRenderer accessibility (focus indicator, aria-label)

---

## Session Summary (2026-01-21 - Session 2)

### Work Completed This Session

This brief session verified and documented Phase 4 (Shared Types Update) completion:

1. **TypeScript Verification** - Confirmed `pnpm exec tsc --noEmit` passes with all new types
2. **Task Documentation Update** - Marked Phase 4 tasks 4.1-4.8 as complete

### Phase 4 Implementation Status (Already in Code)

All Phase 4 types were already implemented in `packages/types/src/index.ts`:
- `VideoContext` interface (lines 26-35)
- `KeyValueBlock` interface (lines 95-99)
- `ComparisonBlock` interface (lines 101-106)
- `TimestampBlock` interface (lines 108-113)
- Variant fields on existing blocks (lines 45-91)
- `ContentBlock` union updated (lines 134-146)
- `VideoResponse.context` field (line 270)

---

## Session Summary (2026-01-21 - Session 1)

### Work Completed

This session focused on **content block improvements** and **timestamp interactivity**, not the video context extraction pipeline. The work bridges frontend UI improvements needed before/alongside the video context feature.

#### Key Changes Made

1. **Timestamp Block Stop Button** - TimestampRenderer now shows a stop button when video is playing from that timestamp
2. **Fixed Timestamp Playback Bug** - Clicking timestamps now plays from the correct time (not section start)
3. **Content Block Alignment** - Fixed left overflow issues with checklist and timestamp blocks
4. **Simplified Callout Styling** - Removed icon/label, now just colored border + text
5. **Code Block Padding** - Added horizontal padding to code areas

### Files Modified This Session

| File | Changes |
|------|---------|
| `apps/web/src/components/video-detail/ContentBlocks.tsx` | Added `onStop`, `isVideoActive`, `activeStartSeconds` props |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Thread new props to TimestampRenderer, simplified callout |
| `apps/web/src/components/video-detail/blocks/TimestampRenderer.tsx` | Added stop button state, `isActive` prop |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Pass new props to ContentBlocks |
| `apps/web/src/components/video-detail/VideoDetailLayout.tsx` | Added `activeStartSeconds` state for correct timestamp playback |

### Architecture Decisions Made

1. **Prop Threading Pattern** - Props flow: `VideoDetailLayout` → `ArticleSection` → `ContentBlocks` → `ContentBlockRenderer` → `TimestampRenderer`

2. **isActive Calculation** - `isActive={isVideoActive && activeStartSeconds === block.seconds}` determines if a specific timestamp is playing

3. **Two-State Button** - TimestampRenderer conditionally renders play or stop button based on `isActive` prop

---

## Key Files Reference

### Backend - Summarizer Service

| File | Purpose | Key Functions |
|------|---------|---------------|
| `services/summarizer/src/services/youtube.py` | YouTube data extraction | `extract_video_data()`, `VideoData` dataclass |
| `services/summarizer/src/services/llm.py` | LLM orchestration | `summarize_section()`, `PERSONA_GUIDELINES` (to add) |
| `services/summarizer/src/prompts/section_summary.txt` | Section prompt template | Add persona + variant guidance |
| `services/summarizer/src/routes/stream.py` | SSE streaming endpoint | Pass context through pipeline |
| `services/summarizer/src/models/schemas.py` | Pydantic models | Add `VideoContext` model |

### Shared Types

| File | Purpose | Key Types |
|------|---------|-----------|
| `packages/types/src/index.ts` | Shared TypeScript types | `ContentBlock`, `Section`, `VideoSummary` |

### Frontend - Video Detail (Updated This Session)

| File | Purpose | Key Components |
|------|---------|----------------|
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Block rendering | `ContentBlockRenderer`, `ExampleBlock`, `CalloutBlock` |
| `apps/web/src/components/video-detail/ContentBlocks.tsx` | Container for blocks | Props: `onStop`, `isVideoActive`, `activeStartSeconds` |
| `apps/web/src/components/video-detail/blocks/TimestampRenderer.tsx` | Timestamp block | Play/Stop states, `isActive` prop |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Section layout | Passes video state to ContentBlocks |
| `apps/web/src/components/video-detail/VideoDetailLayout.tsx` | Page layout | `activeStartSeconds` state |

---

## Key Design Decisions

### 1. Persona vs Category

**Decision:** Use derived `persona` (code/recipe/standard), not raw YouTube `category`.

**Rationale:**
- YouTube categories are broad ("Science & Technology" includes both coding tutorials and science news)
- Persona allows keyword refinement (tech + "python" → code)
- Fewer personas = simpler frontend views
- Categories still passed to LLM for context

### 2. Block Architecture: Semantic Variants

**Decision:** Add `variant` field to blocks, not new block types per persona.

**Rationale:**
- Avoids type explosion (no `RecipeIngredientsBlock`, `CodeTerminalBlock`)
- Single renderer per block type, variant affects styling only
- Graceful degradation (unknown variant → default styling)
- LLM output format stays consistent

**Example:**
```typescript
// Instead of new block types:
type RecipeIngredientsBlock = { type: 'recipe_ingredients'; items: string[] }
type CodeTerminalBlock = { type: 'code_terminal'; command: string }

// Use variants on existing types:
type BulletsBlock = { type: 'bullets'; variant?: 'ingredients'; items: string[] }
type ExampleBlock = { type: 'example'; variant?: 'terminal_command'; code: string }
```

### 3. New Block Types

**Decision:** Add 3 new block types that are genuinely structural, not just styling.

| Block | Why New Type (not variant) |
|-------|---------------------------|
| `keyvalue` | Different structure: array of `{key, value}` pairs |
| `comparison` | Different structure: `{left, right}` with labels |
| `timestamp` | Different structure: `{time, seconds, label}` |

### 4. Timestamp Stop Button (NEW - This Session)

**Decision:** TimestampRenderer shows stop button when `isActive` is true.

**Rationale:**
- Consistent with section title play/stop button behavior
- User can stop video from the same place they started it
- Red stop color provides clear visual feedback

**Implementation:**
```typescript
// isActive determined by comparing block.seconds with activeStartSeconds
isActive={isVideoActive && activeStartSeconds === block.seconds}

// TimestampRenderer conditionally renders:
if (isActive) {
  return <StopButton onClick={onStop} />;
}
return <PlayButton onClick={() => onPlay(block.seconds)} />;
```

### 5. Tags Display Strategy

**Decision:** Show `displayTags` (cleaned, max 6) to users; use raw `tags` for LLM context.

**Rationale:**
- YouTube tags can be spammy/redundant
- Hashtags from description are user-curated
- Max 6 tags keeps UI clean
- Deduplicated across tags + hashtags

### 6. Existing Videos

**Decision:** Leave existing videos without context (null/undefined).

**Rationale:**
- Avoids expensive retroactive processing
- Frontend handles missing context gracefully
- New videos get context automatically
- Optional: Admin script for batch context extraction

---

## Technical Constraints

### yt-dlp Data Available

```python
# From yt-dlp extract_info()
info = {
    'categories': ['Science & Technology'],  # YouTube category (usually 1)
    'tags': ['python', 'tutorial', 'coding', ...],  # Can be 20+ tags
    'description': '... #hashtag1 #hashtag2 ...',  # Contains hashtags
    'title': '...',
    'channel': '...',
    # ... other fields already extracted
}
```

### LLM Prompt Token Budget

Current prompt: ~800 tokens
With persona guidance: ~1000 tokens
With variant examples: ~1200 tokens

**Budget:** Stay under 1500 tokens for section_summary prompt to maintain quality.

### Content Block Contract

All blocks must:
1. Have `type` field as discriminator
2. Support optional `variant` field
3. Be serializable to JSON
4. Have TypeScript interface in `@vie/types`
5. Have renderer in `ContentBlockRenderer.tsx`

---

## Persona Mapping Rules

### Code Persona

**Triggers:**
- Category: "Science & Technology" OR "Education"
- AND has code keywords: programming, coding, code, javascript, python, react, tutorial, github, api, developer, typescript, node, rust, go

**LLM Guidance:**
- Use `example` blocks with `variant: "terminal_command"` for CLI
- Use `comparison` blocks with `variant: "dos_donts"` for best practices
- Include actual code snippets
- Use technical terminology

### Recipe Persona

**Triggers:**
- Category: "Howto & Style" OR "Entertainment"
- AND has food keywords: recipe, cooking, food, cook, chef, meal, kitchen, bake, ingredient, dish

**LLM Guidance:**
- Use `keyvalue` blocks with `variant: "info"` for prep time, servings
- Use `bullets` with `variant: "ingredients"` for ingredient lists
- Use `numbered` with `variant: "cooking_steps"` for steps
- Use `callout` with `variant: "chef_tip"` for tips
- Use `timestamp` blocks for technique demonstrations

### Standard Persona (Default)

**Triggers:**
- Any video not matching code or recipe rules

**LLM Guidance:**
- Standard block types without variants
- Focus on actionable takeaways
- Use `timestamp` blocks for key moments

---

## Frontend Variant Styling Guide

### Tailwind v4 CSS Variables

All styling should use semantic colors from theme:
- `bg-background`, `bg-card`, `bg-muted`
- `text-foreground`, `text-muted-foreground`
- `border-border`

### Variant Styling Pattern

```tsx
const variantStyles: Record<string, string> = {
  ingredients: 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400',
  cooking_steps: 'bg-emerald-50 dark:bg-emerald-950/30',
  terminal_command: 'bg-zinc-950 font-mono',
  chef_tip: 'border-amber-500',
  default: ''
};

const style = variantStyles[block.variant ?? 'default'] ?? variantStyles.default;
```

### New Block Styling

| Block | Base Style | Variants |
|-------|------------|----------|
| `keyvalue` | Two-column grid, alternating rows | `specs`: tech look, `info`: warm, `cost`: accent |
| `comparison` | Side-by-side columns | `dos_donts`: green/red, `pros_cons`: blue/orange, `versus`: neutral |
| `timestamp` | Inline clickable | Blue link styling, play icon, **red stop when active** |

---

## Code Review Findings (This Session)

A code review was run on the timestamp stop button changes. Key findings:

### Issues to Address (Optional)

| Priority | Issue | Fix |
|----------|-------|-----|
| Medium | Missing visible focus indicator | Add `focus-visible:ring-2 focus-visible:ring-primary` |
| Low | Awkward aria-label when `block.label` is empty | Conditionally include label |
| Low | Inline function in ArticleSection creates new ref each render | Consider memoizing if perf issues |

### Strengths Noted
- Clean prop threading pattern
- Good TypeScript typing
- Proper memoization on TimestampRenderer
- Good accessibility basics

---

## Testing Strategy

### Unit Tests

1. `youtube.py`: Test `extract_video_context()` with various category/tag combos
2. `llm.py`: Test persona injection in prompts
3. TypeScript: Type checking with new block types

### Integration Tests

1. Stream endpoint returns context in SSE events
2. Frontend renders new block types
3. Variant styling applied correctly

### Manual Testing

| Scenario | Expected Persona | Video Example |
|----------|------------------|---------------|
| React tutorial | code | Any Fireship video |
| Cooking video | recipe | Binging with Babish |
| News/documentary | standard | Vox explainer |
| Gaming stream | standard | (no gaming persona yet) |

---

## Migration Notes

### Database Schema

No migration needed. `context` field is optional on `VideoSummaryCache`:

```javascript
// MongoDB - optional field
{
  _id: ObjectId,
  youtubeId: string,
  // ... existing fields
  context: {                    // NEW - optional
    youtubeCategory: string,
    persona: string,
    tags: string[],
    displayTags: string[]
  } | null
}
```

### API Response

Context included in video response if available:

```typescript
interface VideoResponse {
  // ... existing fields
  context?: VideoContext;  // NEW - optional
}
```

### Frontend Handling

```tsx
// Graceful handling of missing context
const persona = video.context?.persona ?? 'standard';
const displayTags = video.context?.displayTags ?? [];
```
