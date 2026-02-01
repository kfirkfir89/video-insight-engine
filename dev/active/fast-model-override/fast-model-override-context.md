# Fast Model Override - Context

**Last Updated:** 2026-01-28
**Status:** ✅ COMPLETED

---

## Key Files

### Primary Files (Changed)

| File | Purpose |
|------|---------|
| `services/summarizer/src/services/llm_provider.py` | LiteLLM abstraction with multi-provider support |
| `services/summarizer/src/dependencies.py` | FastAPI dependency injection, creates LLMProvider |
| `services/summarizer/src/services/llm.py` | LLM service for video summarization |
| `services/summarizer/src/routes/stream.py` | SSE streaming endpoint, orchestrates parallel tasks |

### Supporting Files (Reference)

| File | Purpose |
|------|---------|
| `services/summarizer/src/config.py` | Settings including MODEL_MAP |
| `services/summarizer/src/models/schemas.py` | ProviderConfig schema |
| `services/summarizer/src/services/description_analyzer.py` | Uses fast model for description extraction |

---

## Architecture

```
Dev Tool Request
    ↓
providers: { default: "anthropic", fast: "gemini", fallback: "openai" }
    ↓
create_llm_provider(providers)
    ↓
MODEL_MAP lookup → fast_model = "gemini/gemini-1.5-flash"
    ↓
LLMProvider(model=..., fast_model=fast_model, fallback_models=...)
    ↓
LLMService(provider)
    ↓
llm_service.fast_model → "gemini/gemini-1.5-flash"
    ↓
analyze_description(description, fast_model=llm_service.fast_model)
    ↓
LiteLLM acompletion(model="gemini/gemini-1.5-flash", ...)
```

---

## MODEL_MAP Reference

From `services/summarizer/src/config.py`:

```python
MODEL_MAP: dict[str, dict[str, str]] = {
    "anthropic": {
        "default": "anthropic/claude-sonnet-4-20250514",
        "fast": "anthropic/claude-3-5-haiku-20241022",
    },
    "openai": {
        "default": "openai/gpt-4o",
        "fast": "openai/gpt-4o-mini",
    },
    "gemini": {
        "default": "gemini/gemini-1.5-pro",
        "fast": "gemini/gemini-1.5-flash",
    },
}
```

---

## Dependencies

- **LiteLLM** - Multi-provider LLM abstraction
- **FastAPI** - Dependency injection system
- **Pydantic** - Schema validation for ProviderConfig

---

## Key Decisions

1. **Provider property on LLMService**: Exposes `fast_model` via property to allow call sites to access it without knowing about the provider internals.

2. **Explicit parameter passing**: `analyze_description()` receives `fast_model` as explicit parameter rather than accessing a global, making the dependency clear and testable.

3. **Fallback behavior**: If `providers.fast` is not specified or invalid, falls back to anthropic fast model.

---

## Testing Considerations

- Mock `LLMProvider` with custom `fast_model` for unit tests
- Verify `create_llm_provider()` correctly resolves MODEL_MAP entries
- Check log output shows expected model selection
