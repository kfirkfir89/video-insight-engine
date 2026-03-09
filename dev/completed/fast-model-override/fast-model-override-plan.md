# Fast Model Override Implementation Plan

**Last Updated:** 2026-01-28
**Status:** ✅ COMPLETED

---

## Executive Summary

Enable dev tool override of the fast model (used for quick tasks like description analysis) via the `providers.fast` field. Previously, only `default` and `fallback` providers were wired - the `fast` provider was ignored.

---

## Problem Statement

The dev tool sends `providers.fast` configuration to select a different LLM provider for fast tasks (e.g., Gemini for description analysis), but this was being ignored. The `create_llm_provider()` factory only wired `default` and `fallback` models, leaving `fast_model` to always use the default from settings.

---

## Current State Analysis

### Before Implementation

```python
# dependencies.py - BEFORE
def create_llm_provider(providers: ProviderConfig | None = None) -> LLMProvider:
    if providers is None:
        return get_llm_provider()

    default_model = MODEL_MAP.get(providers.default, {}).get("default", ...)

    # providers.fast was ignored!

    fallback_models = None
    if providers.fallback:
        fallback_models = [MODEL_MAP.get(providers.fallback, {}).get("default")]

    return LLMProvider(
        model=default_model,
        fallback_models=fallback_models,
        # fast_model was missing!
    )
```

### After Implementation (Current)

All changes have been implemented:

1. **LLMProvider** - `fast_model` parameter and property added
2. **create_llm_provider()** - Now wires `providers.fast` to `fast_model`
3. **LLMService** - `fast_model` property exposes provider's fast model
4. **analyze_description()** - Called with `fast_model=llm_service.fast_model`

---

## Implementation Details

### 1. LLMProvider (`llm_provider.py`)

```python
class LLMProvider:
    def __init__(
        self,
        model: str | None = None,
        fast_model: str | None = None,  # ✅ Added
        fallback_models: list[str] | None = None,
        ...
    ):
        self._model = model or settings.llm_model
        self._fast_model = fast_model or settings.llm_fast_model  # ✅ Added
        ...

    @property
    def fast_model(self) -> str:  # ✅ Added
        return self._fast_model
```

### 2. create_llm_provider (`dependencies.py`)

```python
def create_llm_provider(providers: ProviderConfig | None = None) -> LLMProvider:
    if providers is None:
        return get_llm_provider()

    default_model = MODEL_MAP.get(providers.default, {}).get("default", ...)

    # ✅ Handle fast model
    fast_model = None
    if providers.fast:
        fast_model = MODEL_MAP.get(providers.fast, {}).get("fast", ...)

    fallback_models = None
    if providers.fallback:
        fallback_models = [MODEL_MAP.get(providers.fallback, {}).get("default")]

    return LLMProvider(
        model=default_model,
        fast_model=fast_model,  # ✅ Now wired
        fallback_models=fallback_models,
    )
```

### 3. LLMService (`llm.py`)

```python
class LLMService:
    @property
    def fast_model(self) -> str:  # ✅ Added
        return self._provider.fast_model
```

### 4. Usage in stream.py

```python
# Fast model from provider is passed to description analyzer
tasks["description"] = asyncio.create_task(
    analyze_description(video_data.description, fast_model=llm_service.fast_model),
    name="description"
)
```

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `services/summarizer/src/services/llm_provider.py` | Add `fast_model` param + property | ✅ Done |
| `services/summarizer/src/dependencies.py` | Wire `fast_model` in `create_llm_provider()` | ✅ Done |
| `services/summarizer/src/services/llm.py` | Add `fast_model` property | ✅ Done |
| `services/summarizer/src/routes/stream.py` | Pass `fast_model` to `analyze_description()` | ✅ Done |

---

## Verification Steps

```bash
# 1. Use dev tool to select different fast provider (e.g., gemini)
# 2. Trigger summarization
# 3. Check logs for "Creating custom LLMProvider: model=..., fast_model=gemini/..."
```

Expected log output:
```
INFO: Creating custom LLMProvider: model=anthropic/claude-sonnet-4-20250514, fast_model=gemini/gemini-1.5-flash, fallback=[...]
```

---

## Success Metrics

- [x] `providers.fast` is read from dev tool config
- [x] `fast_model` is resolved via MODEL_MAP
- [x] `LLMProvider` stores and exposes `fast_model`
- [x] `LLMService` exposes `fast_model` property
- [x] `analyze_description()` uses the overridden fast model
- [x] Logs show correct model being used

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Invalid provider name | Low | Low | Falls back to anthropic defaults via MODEL_MAP |
| Missing fast key in MODEL_MAP | Low | Low | Fallback to anthropic fast model |

---

## Timeline

- **Planned:** 2026-01-28
- **Completed:** 2026-01-28 (all changes verified in codebase)
