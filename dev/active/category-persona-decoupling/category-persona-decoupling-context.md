# Category-Persona Decoupling - Context

**Last Updated**: 2026-02-05

---

## Key Files

### Files to Modify

| File | Purpose | Key Functions |
|------|---------|---------------|
| `services/summarizer/src/services/youtube.py` | Video data extraction & context detection | `extract_video_context()`, `_determine_persona()`, `VideoContext` |
| `services/summarizer/src/routes/stream.py` | SSE streaming endpoint | `extract_context()` at line 190 |
| `services/summarizer/src/services/llm_provider.py` | Multi-provider LLM abstraction | `LLMProvider.complete()`, `LLMProvider.fast_model` |
| `services/summarizer/src/prompts/detection/persona_rules.json` | Persona detection rules | Static JSON config |

### Files to Create

| File | Purpose |
|------|---------|
| `services/summarizer/src/prompts/detection/category_rules.json` | Category detection rules with weighted scoring config |

### Test Files

| File | Purpose |
|------|---------|
| `services/summarizer/tests/test_youtube_service.py` | YouTube service tests - add category detection tests |

---

## Current Architecture

### VideoContext Dataclass (youtube.py:64-79)

```python
@dataclass
class VideoContext:
    youtube_category: str | None
    persona: str  # "code", "recipe", or "standard"
    tags: list[str]
    display_tags: list[str]
```

**Problem**: No separate `category` field. Category is reverse-mapped from persona in stream.py.

### _determine_persona() (youtube.py:96-136)

```python
def _determine_persona(category, tags, hashtags) -> str:
    # Must be in matching category AND have matching keywords
    is_matching_category = category in categories if category else False
    has_matching_keywords = bool(all_terms & keywords)

    if is_matching_category and has_matching_keywords:
        return persona_name
```

**Problem**: AND logic means if YouTube category doesn't match, persona fails.

### extract_context() in stream.py (lines 190-220)

```python
def extract_context(video_data: VideoData) -> tuple[dict[str, Any] | None, str]:
    # Map persona to user-facing category
    persona_to_category = {
        'code': 'coding',
        'recipe': 'cooking',
        # ...
    }

    persona = video_data.context.persona
    category = persona_to_category.get(persona, 'general')
```

**Problem**: Category DERIVED from persona. If persona = "standard", category = "general".

### persona_rules.json

```json
{
  "personas": {
    "code": {
      "keywords": ["programming", "coding", ...],
      "categories": ["Science & Technology", "Education"]
    },
    "recipe": {
      "keywords": ["recipe", "cooking", ...],
      "categories": ["Howto & Style", "People & Blogs"]
    }
  },
  "default_persona": "standard"
}
```

---

## Target Architecture

### New VideoContext Dataclass

```python
@dataclass
class VideoContext:
    youtube_category: str | None   # Raw YouTube category
    category: str                   # Detected category (cooking, coding, etc.)
    persona: str                    # Selected persona for LLM
    tags: list[str]
    display_tags: list[str]
```

### New Detection Flow

```
1. _detect_category(youtube_category, tags, hashtags, channel, title)
   → Returns (category, confidence_score)

2. If confidence < 0.4:
   _classify_category_with_llm(title, channel, tags, description)
   → Returns category via fast LLM call

3. _select_persona(category)
   → Returns persona based on simple mapping
```

### New extract_video_context() (async)

```python
async def extract_video_context(
    info: dict[str, Any],
    description: str,
    channel: str | None = None,
    title: str | None = None,
) -> VideoContext:
    # Step 1: Rule-based category detection
    category, confidence = _detect_category(youtube_category, tags, hashtags, channel, title)

    # Step 2: LLM fallback if low confidence
    if confidence < 0.4 and title:
        category = await _classify_category_with_llm(title, channel, tags, description)

    # Step 3: Select persona based on category
    persona = _select_persona(category)

    return VideoContext(
        youtube_category=youtube_category,
        category=category,
        persona=persona,
        tags=tags,
        display_tags=display_tags,
    )
```

---

## LLM Provider Integration

### Current LLMProvider (llm_provider.py)

```python
class LLMProvider:
    def __init__(self, model=None, fast_model=None, fallback_models=None, timeout=None):
        self._model = model or settings.llm_model
        self._fast_model = fast_model or settings.llm_fast_model

    @property
    def fast_model(self) -> str:
        return self._fast_model

    async def complete(self, prompt: str, max_tokens: int = 2000) -> str:
        # Uses self._model (default model)
```

### Need to Add

```python
async def complete_fast(self, prompt: str, max_tokens: int = 50, timeout: float = 5.0) -> str:
    """Quick completion using fast model for simple classifications."""
    # Uses self._fast_model instead of self._model
```

---

## Category Rules Configuration

### Structure for category_rules.json

```json
{
  "version": "1.0",
  "detection_config": {
    "llm_fallback_threshold": 0.4,
    "weights": {
      "keywords": 0.40,
      "youtube_category": 0.30,
      "title": 0.15,
      "channel": 0.15
    }
  },
  "categories": {
    "cooking": {
      "keywords": {
        "primary": ["recipe", "cooking", "cook", "chef", "meal"],
        "secondary": ["ingredient", "kitchen", "bake", "food"]
      },
      "youtube_categories": {
        "primary": ["Howto & Style"],
        "secondary": ["People & Blogs", "Entertainment"]
      },
      "channel_patterns": ["jamie oliver", "gordon ramsay"],
      "title_patterns": ["recipe", "how to make", "\\d+ minute meal"]
    }
  },
  "default_category": "standard"
}
```

---

## Dependencies

### Internal Dependencies

| Component | Dependency | Why |
|-----------|-----------|-----|
| `youtube.py` | `llm_provider.py` | For LLM fallback |
| `youtube.py` | `category_rules.json` | For detection rules |
| `stream.py` | `youtube.py` | Uses VideoContext |

### External Dependencies

| Package | Used For |
|---------|----------|
| `litellm` | LLM calls via LLMProvider |

---

## Data Flow

### Before (Current)

```
yt-dlp info
    ↓
extract_video_context(info, description)
    ↓
_determine_persona(category, tags, hashtags)  ← AND logic fails!
    ↓
VideoContext(persona="standard")
    ↓
extract_context() in stream.py
    ↓
persona_to_category["standard"] → "general"
    ↓
Frontend shows StandardView (wrong!)
```

### After (Target)

```
yt-dlp info
    ↓
await extract_video_context(info, description, channel, title)
    ↓
_detect_category(youtube_category, tags, hashtags, channel, title)
    ↓
category="cooking", confidence=0.75  ← Weighted scoring succeeds
    ↓
_select_persona("cooking") → "recipe"
    ↓
VideoContext(category="cooking", persona="recipe")
    ↓
extract_context() uses context.category directly
    ↓
Frontend shows RecipeView (correct!)
```

---

## Backward Compatibility

### Changes Required

| Location | Change | Breaking? |
|----------|--------|-----------|
| `VideoContext.category` | New field | No - additive |
| `extract_video_context()` | Now async | Yes - must await |
| `_extract_video_data_sync()` | Cannot call async from sync | Need workaround |
| `extract_context()` | Use new structure | No - internal |

### Mitigation for Async Issue

`_extract_video_data_sync()` is synchronous but needs to call async `extract_video_context()`.

Options:
1. Make `extract_video_context()` have a sync path (rule-based only)
2. Run async in thread pool with `asyncio.run()`
3. Keep sync detection, defer LLM fallback to stream.py

**Recommended**: Option 1 - Keep sync for high-confidence cases, only use async when LLM fallback needed.

```python
def extract_video_context_sync(...) -> VideoContext:
    """Synchronous extraction - rule-based only."""
    category, confidence = _detect_category(...)
    if confidence < 0.4:
        # Mark for async fallback
        category = "pending_llm"
    persona = _select_persona(category)
    return VideoContext(...)

async def finalize_video_context(context: VideoContext, ...) -> VideoContext:
    """Async finalization with LLM fallback if needed."""
    if context.category == "pending_llm":
        context.category = await _classify_category_with_llm(...)
        context.persona = _select_persona(context.category)
    return context
```

---

## Error Handling

### LLM Fallback Errors

| Error | Handling |
|-------|----------|
| Timeout | Use "standard" category |
| Rate limit | Use "standard" category |
| API error | Use "standard" category |

Always degrade gracefully - never fail summarization due to category detection.

---

## Performance Considerations

| Operation | Expected Latency | Frequency |
|-----------|-----------------|-----------|
| Rule-based detection | <10ms | Every video |
| LLM fallback | 1-2s | <20% of videos |

### When LLM Fallback Triggers

- No strong keyword signals
- YouTube category is ambiguous (e.g., "Entertainment", "People & Blogs")
- Title/channel don't match known patterns
