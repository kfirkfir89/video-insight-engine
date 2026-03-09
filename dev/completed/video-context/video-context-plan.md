# Video Context Enhancement Plan

**Last Updated:** 2026-01-20

---

## Executive Summary

Enhance video summarization with YouTube metadata-derived **video context** to enable content-aware summarization with specialized UI views per content type.

**Goal:** Extract YouTube categories/tags → derive persona → guide LLM prompts + render specialized UI views.

**MVP Scope:**
- 3 personas: `code`, `recipe`, `standard`
- 3 new content blocks: `keyvalue`, `comparison`, `timestamp`
- Semantic variants for existing blocks (styling hints)
- YouTube-style tags display

---

## Current State Analysis

### What We Have

| Component | Status | Notes |
|-----------|--------|-------|
| YouTube extraction | yt-dlp extracts title, channel, chapters, description | Missing: categories, tags |
| Content blocks | 7 types: paragraph, bullets, numbered, do_dont, example, callout, definition | No semantic variants |
| Frontend renderer | `ContentBlockRenderer.tsx` handles all block types | Single view, no persona awareness |
| Types | `@vie/types` has `ContentBlock` union | No VideoContext type |
| LLM prompts | Generic section_summary.txt | No persona-specific guidance |

### Key Files to Modify

| Layer | File | Current State |
|-------|------|---------------|
| Backend | `services/summarizer/src/services/youtube.py` | Has VideoData dataclass, no context |
| Backend | `services/summarizer/src/services/llm.py` | Generic prompts, no persona awareness |
| Backend | `services/summarizer/src/prompts/section_summary.txt` | Generic format |
| Types | `packages/types/src/index.ts` | 7 content block types, no variants |
| Frontend | `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | No variant support |
| Frontend | N/A (new) | No specialized views |

---

## Proposed Future State

### Architecture Flow

```
YouTube Video
    │
    ▼
┌─────────────────────────────────────┐
│ yt_dlp.extract_info()               │
│ Extract: categories, tags, hashtags │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ extract_video_context()             │
│ Derive: persona, displayTags        │
└──────────────────┬──────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
    ▼                             ▼
┌────────────┐            ┌─────────────┐
│ LLM Prompt │            │  Frontend   │
│ (persona)  │            │ (tags + view)│
└────────────┘            └─────────────┘
```

### New Types

```typescript
// VideoContext - passed through system
interface VideoContext {
  youtubeCategory: string;     // "Science & Technology"
  persona: 'code' | 'recipe' | 'standard';
  tags: string[];              // Raw YouTube tags (max 15)
  displayTags: string[];       // Cleaned for UI (max 6)
}

// New content blocks
interface KeyValueBlock {
  type: 'keyvalue';
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location';
  items: { key: string; value: string }[];
}

interface ComparisonBlock {
  type: 'comparison';
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
  left: { label: string; items: string[] };
  right: { label: string; items: string[] };
}

interface TimestampBlock {
  type: 'timestamp';
  time: string;       // "5:23"
  seconds: number;    // 323
  label: string;      // "Setting up the project"
}
```

### Persona Mapping Logic

```python
PERSONA_MAP = {
    "Science & Technology": "tech",
    "Education": "educational",
    "Howto & Style": "tutorial",
    "Food": "recipe",
}

# Refinement for tech category
TECH_CODE_KEYWORDS = {
    "programming", "coding", "code", "javascript", "python",
    "react", "tutorial", "github", "api", "developer"
}

# If tech + code keywords → "code" persona
# If Howto & Style + food keywords → "recipe" persona
```

---

## Implementation Phases

### Phase 1: Backend - Context Extraction (Effort: M)

**Goal:** Extract YouTube metadata and derive video context.

**Files:**
- `services/summarizer/src/services/youtube.py`
- `services/summarizer/src/models/schemas.py`

**Changes:**
1. Add `categories` and `tags` extraction to `_extract_video_data_sync()`
2. Create `extract_video_context()` function for persona derivation
3. Add `VideoContext` dataclass
4. Update `VideoData` to include `context` field

**Key Implementation:**
```python
@dataclass
class VideoContext:
    youtube_category: str | None
    persona: str  # 'code', 'recipe', 'standard'
    tags: list[str]
    display_tags: list[str]

def extract_video_context(info: dict) -> VideoContext:
    categories = info.get('categories', [])
    category = categories[0] if categories else None
    tags = (info.get('tags') or [])[:15]
    hashtags = re.findall(r'#(\w+)', (info.get('description') or '').lower())[:10]
    persona = _determine_persona(category, tags, hashtags)
    display_tags = _build_display_tags(tags, hashtags)
    return VideoContext(category, persona, tags, display_tags)
```

---

### Phase 2: Backend - Prompt Enhancement (Effort: M)

**Goal:** Inject persona-specific guidance into LLM prompts.

**Files:**
- `services/summarizer/src/services/llm.py`
- `services/summarizer/src/prompts/section_summary.txt`

**Changes:**
1. Add `PERSONA_GUIDELINES` and `VARIANT_EXAMPLES` dicts
2. Modify `summarize_section()` to accept persona parameter
3. Update prompt template to include persona guidance
4. Document new block types in prompt

**Prompt Enhancement Pattern:**
```python
PERSONA_GUIDELINES = {
    'code': """
You are a principal software engineer teaching.
- Use "example" blocks with variant "terminal_command" for CLI commands
- Use "comparison" blocks with variant "dos_donts" for best practices
- Use "timestamp" blocks for key code demonstrations
""",
    'recipe': """
You are a friendly chef sharing a recipe.
- Use "keyvalue" with variant "info" for prep time, servings
- Use "bullets" with variant "ingredients" for ingredient lists
- Use "numbered" with variant "cooking_steps" for steps
- Use "callout" with variant "chef_tip" for tips
""",
    # ...
}
```

---

### Phase 3: Backend - Stream Integration (Effort: S)

**Goal:** Pass context through the streaming pipeline.

**Files:**
- `services/summarizer/src/routes/stream.py`
- `services/summarizer/src/services/summarizer_service.py`

**Changes:**
1. Extract context during video data extraction
2. Pass context to LLM service methods
3. Include context in SSE events
4. Store context in MongoDB with summary

---

### Phase 4: Shared Types Update (Effort: M)

**Goal:** Add TypeScript types for new blocks and context.

**Files:**
- `packages/types/src/index.ts`

**Changes:**
1. Add `VideoContext` interface
2. Add `KeyValueBlock`, `ComparisonBlock`, `TimestampBlock` interfaces
3. Add `variant` field to existing block interfaces
4. Update `ContentBlock` union type
5. Update `VideoSummaryCache` to include `context`

---

### Phase 5: Frontend - New Block Renderers (Effort: M)

**Goal:** Implement renderers for new content block types.

**Files:**
- `apps/web/src/components/video-detail/blocks/KeyValueRenderer.tsx` (new)
- `apps/web/src/components/video-detail/blocks/ComparisonRenderer.tsx` (new)
- `apps/web/src/components/video-detail/blocks/TimestampRenderer.tsx` (new)
- `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` (update)

**Key Features:**
- `KeyValueRenderer`: Grid/list layout for key-value pairs with variant styling
- `ComparisonRenderer`: Two-column side-by-side layout
- `TimestampRenderer`: Clickable timestamp that seeks video

---

### Phase 6: Frontend - Variant Styling (Effort: M)

**Goal:** Add semantic variant support to existing blocks.

**Files:**
- `apps/web/src/components/video-detail/ContentBlockRenderer.tsx`

**Changes:**
1. Add variant-aware styling to each block type
2. Create variant style maps for each block
3. Graceful fallback for unknown variants

**Example:**
```tsx
const bulletVariants = {
  ingredients: 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400 pl-4',
  default: ''
};
```

---

### Phase 7: Frontend - Tags Display (Effort: S)

**Goal:** Display YouTube-style tags on video detail page.

**Files:**
- `apps/web/src/components/video-detail/VideoDetailHeader.tsx` (or similar)

**Implementation:**
```tsx
{context?.displayTags?.length > 0 && (
  <div className="flex gap-2 flex-wrap">
    {context.displayTags.map(tag => (
      <span key={tag} className="px-2 py-0.5 bg-muted rounded-full text-xs">
        #{tag}
      </span>
    ))}
  </div>
)}
```

---

### Phase 8: Frontend - Specialized Views (Effort: L) - OPTIONAL

**Goal:** Create persona-specific view layouts.

**Files:**
- `apps/web/src/components/video-detail/views/CodeView.tsx` (new)
- `apps/web/src/components/video-detail/views/RecipeView.tsx` (new)
- `apps/web/src/components/video-detail/views/StandardView.tsx` (new)

**Decision:** This phase is optional for MVP. The variant styling from Phase 6 provides persona-specific rendering without requiring separate view components. Implement only if significant layout differences are needed between personas.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| yt-dlp doesn't return categories/tags | Low | High | Test with multiple videos; fallback to 'standard' persona |
| LLM doesn't follow persona guidelines | Medium | Medium | Iterate on prompts; validate output format |
| New blocks break existing summaries | Low | High | Backward-compatible types; graceful fallback |
| Frontend type mismatches | Medium | Low | Strict TypeScript; runtime validation |
| Performance impact from context extraction | Low | Low | Context extraction is lightweight metadata parsing |

---

## Success Metrics

1. **Context Extraction:**
   - 90%+ videos get valid persona (not just 'standard')
   - Tags extracted for 80%+ videos with tags

2. **LLM Output Quality:**
   - Code videos produce `comparison` blocks with `dos_donts` variant
   - Recipe videos produce `keyvalue` blocks with prep time info
   - Timestamp blocks generated for 50%+ sections

3. **Frontend Rendering:**
   - All new block types render correctly
   - Variant styling visually distinguishes content types
   - Tags display matches YouTube aesthetic

4. **Fallback Behavior:**
   - Videos without context render normally (standard view)
   - Unknown variants fallback to default styling
   - No runtime errors from malformed blocks

---

## Dependencies

### External
- yt-dlp returns categories/tags (confirmed via API docs)
- Anthropic API supports longer prompts (persona guidelines add ~200 tokens)

### Internal
- TypeScript build must pass with new types
- ContentBlockRenderer must handle unknown blocks gracefully
- MongoDB schema supports optional `context` field

---

## Out of Scope (Post-MVP)

1. Additional personas (gaming, travel, review)
2. User-configurable persona preferences
3. Persona-specific section detection prompts
4. Machine learning-based persona classification
5. Retroactive context extraction for existing videos
