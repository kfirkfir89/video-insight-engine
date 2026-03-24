---
paths:
  - "services/**/*.py"
  - "packages/llm-common/**/*.py"
---

# Python Syntax Patterns

Conventions derived from this codebase. Follow these for consistent style.

<rules>
- ALWAYS use Python 3.12+ union syntax: `str | None` — never `Optional[str]` or `Union[str, None]` (project standard, cleaner)
- ALWAYS use f-strings for interpolation: `f"Duration: {minutes}"` — never `.format()` or `%` (project standard, more readable)
- ALWAYS use `async def` for any function doing I/O — never sync I/O in async context (blocks the entire event loop)
- ALWAYS use module-level logger: `logger = logging.getLogger(__name__)` (consistent log context)
- ALWAYS use `from __future__ import annotations` at top of file (enables forward references, consistent PEP 563)
- ALWAYS prefix private functions with underscore: `def _load_prompt() -> str` (clear public/private boundary)
</rules>

## Types & Models

- Type hints on ALL function signatures (parameters AND return): `async def classify(...) -> Result | None:`
- `dataclass` for value objects, `BaseModel` for validated input
- `SCREAMING_SNAKE_CASE` for module-level constants: `CONFIDENCE_THRESHOLD = 0.6`
- `frozenset` for immutable constant collections

## Imports

- Group: `__future__` → stdlib → third-party → local
- `TYPE_CHECKING` blocks for circular imports: `if TYPE_CHECKING: from ...`
- Relative imports for local modules: `from .assemblers import ...`

## Error Handling

- Catch specific exceptions: `except FileNotFoundError:` — never bare `except:`
- Non-blocking failures: log warning + return None (don't re-raise if caller handles absence)
- LLM calls wrapped in retry utility: `await call_llm_with_retry(...)`
- Structured log context: `logger.error({"youtubeId": ..., "error": ...}, "message")`

## Organization

- Section dividers: `# ─── Section Name ───`
- Helper functions before main functions that use them
- `@lru_cache(maxsize=1)` for deterministic file-loading helpers
