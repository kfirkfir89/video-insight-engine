# Async Patterns

Advanced async patterns for streaming, pipelines, and parallel processing.

<rules>
- ALWAYS use `asyncio.gather()` for independent parallel I/O — never sequential awaits (sequential calls multiply latency by call count)
- ALWAYS use `asyncio.Semaphore` to bound concurrent work on unbounded inputs (unbounded gather on 10K items can exhaust connections, memory, or rate limits)
- ALWAYS use `try/finally` in async generators to ensure resource cleanup (if a consumer stops early, cleanup code after `yield` never executes without finally)
- ALWAYS use `dataclass` for internal pipeline state and `Pydantic` for API boundaries (Pydantic validation overhead is wasted on internal-only data)
- NEVER use `asyncio.gather()` without `return_exceptions=True` when partial failure is acceptable (one exception cancels all results)
- NEVER collect an entire async generator into a list when you could stream it (defeats the purpose of incremental processing and wastes memory)
</rules>

---

## Async Generators

Use for streaming responses, incremental processing, and memory-efficient iteration.

```python
async def stream_chunks(
    text: str, chunk_size: int
) -> AsyncGenerator[str, None]:
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]
        await asyncio.sleep(0)  # Yield control to event loop
```

For pipelines that yield progress then a final result, use union return types: `AsyncGenerator[str | FinalResult, None]`.

---

## Parallel Processing

```python
# Basic parallel — all must succeed
user, orders, prefs = await asyncio.gather(
    fetch_user(id), fetch_orders(id), fetch_preferences(id),
)

# Partial failure tolerance
results = await asyncio.gather(
    fetch_user(id), fetch_orders(id),
    return_exceptions=True,
)
user = results[0] if not isinstance(results[0], Exception) else None

# Rate-limited parallel
async def process_with_limit(items: list[str], max_concurrent: int = 5):
    sem = asyncio.Semaphore(max_concurrent)
    async def limited(item: str):
        async with sem:
            return await process_item(item)
    return await asyncio.gather(*[limited(i) for i in items])
```

Use `asyncio.TaskGroup` (Python 3.11+) for structured concurrency where all-or-nothing semantics are needed.

---

## Pipeline State with Dataclasses

```python
@dataclass
class PipelineContext:
    video_id: str
    state: str = "init"
    completed: list[str] = field(default_factory=list)
    results: dict[str, Any] = field(default_factory=dict)

    def advance_to(self, phase: str) -> None:
        self.completed.append(self.state)
        self.state = phase
```

Use `@dataclass(frozen=True)` for immutable intermediate results. Use mutable dataclasses for pipeline state that accumulates across phases.

---

## Pipeline Composition

Chain async generators for multi-stage streaming. Each stage receives context in, yields results out.

```python
async def orchestrate(ctx: PipelineContext) -> AsyncGenerator[str | Result, None]:
    ctx.advance_to("fetch")
    yield "Fetching..."
    video = await fetch_video(ctx.video_id)
    ctx.results["video"] = video

    ctx.advance_to("analysis")
    async for progress in analyze(video):
        yield progress

    yield FinalResult(video_id=ctx.video_id, summary=ctx.results.get("summary"))
```

---

## Edge Cases

- **Task cancellation leaks**: When using `asyncio.wait()` with timeout, always cancel pending tasks in the `pending` set — otherwise they run forever in the background.
- **Generator cleanup**: If an async generator acquires a resource (file, connection), wrap the yield in `try/finally` — consumers may stop iterating early via `async for ... break`.
- **CPU-bound in async**: Use `asyncio.to_thread()` or `ProcessPoolExecutor` for CPU-bound work. Never run CPU-heavy code directly in an async function.

---

## Rules Summary

Use `asyncio.gather()` for parallel I/O, `Semaphore` to bound concurrency, `TaskGroup` for structured concurrency. Stream with async generators instead of collecting into lists. Use dataclasses for pipeline state and Pydantic for API boundaries. Always handle partial failures with `return_exceptions=True` when appropriate. Clean up resources in `try/finally` blocks within generators. Offload CPU-bound work to threads or processes.
