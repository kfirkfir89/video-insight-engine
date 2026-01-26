# Dev Tool for Model Selection - Context

**Last Updated:** 2025-01-25

---

## Key Files Reference

### Frontend (apps/web)

| File | Purpose | Line Reference |
|------|---------|----------------|
| `components/sidebar/Sidebar.tsx` | Main sidebar - add DevToolPanel here | 24-43 |
| `components/sidebar/SortDropdown.tsx` | Pattern for ProviderSelector | 1-70 |
| `components/sidebar/AddVideoInput.tsx` | Pattern for video URL input | - |
| `stores/ui-store.ts` | UI state management | - |
| `hooks/use-videos.ts` | Video mutations | - |

### API (api)

| File | Purpose | Line Reference |
|------|---------|----------------|
| `routes/videos.routes.ts` | POST /api/videos route | 55-75 |
| `services/video.service.ts` | createVideo() method | 18-285 |
| `services/summarizer-client.ts` | triggerSummarization() | 37-79 |

### Summarizer (services/summarizer)

| File | Purpose | Line Reference |
|------|---------|----------------|
| `models/schemas.py` | SummarizeRequest schema | 24-29 |
| `dependencies.py` | get_llm_provider() DI | 37-40 |
| `routes/stream.py` | SSE streaming endpoint | 546-647 |
| `services/llm_provider.py` | LLMProvider class | 45-313 |
| `config.py` | MODEL_MAP, get_model() | 7-26 |

---

## Model Mapping (from config.py)

```python
MODEL_MAP = {
    "anthropic": {
        "default": "anthropic/claude-sonnet-4-20250514",
        "fast": "anthropic/claude-3-5-haiku-20241022",
    },
    "openai": {
        "default": "openai/gpt-4o",
        "fast": "openai/gpt-4o-mini",
    },
    "gemini": {
        "default": "gemini/gemini-3-flash-preview",
        "fast": "gemini/gemini-2.5-flash-lite",
    },
}
```

---

## Current Request Flow

### 1. Frontend → API

```typescript
// POST /api/videos
{
  url: "https://youtube.com/watch?v=...",
  folderId?: string,
  bypassCache?: boolean
}
```

### 2. API → Summarizer

```typescript
// triggerSummarization() → POST /summarize
{
  videoSummaryId: string,
  youtubeId: string,
  url: string,
  userId?: string
}
```

### 3. Summarizer Processing

- `stream.py` receives request
- Uses DI to get `LLMService` which uses `LLMProvider`
- `LLMProvider` is cached singleton via `@lru_cache`

---

## Architecture Decisions

### Why Extend Existing Routes (vs New Routes)

| Approach | Pros | Cons |
|----------|------|------|
| **Extend existing** | Less code, simpler | Slightly pollutes prod schema |
| New /dev routes | Clean separation | More files, more testing |

**Decision:** Extend existing. The `providers` field is optional and only used when explicitly passed. Zod validation ensures safety.

### Why Request-Scoped Provider

The current `get_llm_provider()` is cached with `@lru_cache`. We cannot modify it per-request.

**Solution:** Create factory function that:
1. Returns cached default if no override
2. Creates new instance if providers specified

```python
def create_llm_provider(providers: ProviderConfig | None = None) -> LLMProvider:
    if providers:
        return LLMProvider(model=..., fallback_models=...)
    return get_llm_provider()  # cached default
```

### Dev-Only Rendering

Use Vite's `import.meta.env.DEV` which:
- Is `true` during `npm run dev`
- Is `false` in production builds
- Tree-shakes unused dev code from bundle

```tsx
{import.meta.env.DEV && <DevToolPanel />}
```

---

## Type Definitions

### ProviderConfig (TypeScript)

```typescript
interface ProviderConfig {
  default: 'anthropic' | 'openai' | 'gemini';
  fast?: 'anthropic' | 'openai' | 'gemini';
  fallback?: 'anthropic' | 'openai' | 'gemini' | null;
}
```

### ProviderConfig (Python)

```python
class ProviderConfig(BaseModel):
    default: str  # Literal['anthropic', 'openai', 'gemini']
    fast: str | None = None
    fallback: str | None = None
```

---

## Testing Approach

### Manual Testing

1. Start dev server: `npm run dev`
2. Verify DevToolPanel visible in sidebar
3. Enter video URL, select OpenAI provider
4. Click re-summarize
5. Check summarizer logs for `openai/gpt-4o`

### Verification Commands

```bash
# Check production build excludes dev components
cd apps/web && npm run build
grep -r "DevToolPanel" dist/  # Should find nothing

# Check summarizer logs
docker logs vie-summarizer -f | grep "Using model"
```

---

## Environment Requirements

Required API keys in `.env`:
- `ANTHROPIC_API_KEY` - For Anthropic models
- `OPENAI_API_KEY` - For OpenAI models
- `GOOGLE_API_KEY` - For Gemini models

If a key is missing, LiteLLM will fail with auth error when that provider is selected.

---

## Related Tasks

- `multi-provider-llm/` - Parent task for LiteLLM migration
- `vie-explainer/` - Future: same pattern for explainer service
