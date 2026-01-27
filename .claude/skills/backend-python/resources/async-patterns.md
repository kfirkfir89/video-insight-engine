# Async Patterns (Python)

Advanced async patterns for streaming, pipelines, and parallel processing.

---

## Async Generators

When a function needs to yield multiple values over time (streaming, pipelines).

### When to Use

- Streaming responses (SSE, WebSocket)
- Processing large datasets incrementally
- Pipeline stages that produce intermediate results
- Memory-efficient iteration over large collections

### DO ✅

```python
from typing import AsyncGenerator

# Basic async generator
async def stream_chunks(text: str, chunk_size: int) -> AsyncGenerator[str, None]:
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]
        await asyncio.sleep(0)  # Allow other tasks to run

# Union return types for streaming with final result
async def summarize_with_progress(
    transcript: str
) -> AsyncGenerator[str | SummaryResult, None]:
    """Yields progress strings, then final SummaryResult."""
    yield "Starting analysis..."

    for i, chunk in enumerate(split_chunks(transcript)):
        yield f"Processing chunk {i + 1}..."
        await process_chunk(chunk)

    yield "Generating final summary..."
    result = await generate_summary()

    yield result  # Final result is the SummaryResult

# Consuming async generators
async def process_stream():
    async for chunk in stream_chunks(large_text, 1000):
        await send_to_client(chunk)

# Collecting all results
async def collect_all():
    results = [item async for item in stream_chunks(text, 100)]
```

### DON'T ❌

```python
# Don't return a list when you could stream
async def get_all_items() -> list[Item]:
    items = []
    async for item in fetch_items():  # Why collect if you can stream?
        items.append(item)
    return items

# Don't mix yields and returns incorrectly
async def broken_generator() -> AsyncGenerator[str, None]:
    yield "first"
    return "this won't work as expected"  # Return in generator = StopIteration value

# Don't forget to handle generator cleanup
async def leaky_generator():
    resource = await acquire_resource()
    try:
        yield resource.data
        # If consumer stops early, cleanup never runs!
    finally:
        await resource.close()  # Use try/finally for cleanup
```

---

## Dataclasses for Internal State

Use dataclasses for internal state management, Pydantic for API boundaries.

### When to Use What

| Use Case              | Use This     | Why                                    |
| --------------------- | ------------ | -------------------------------------- |
| Request/Response DTOs | Pydantic     | Validation, serialization              |
| Internal state        | dataclass    | Lightweight, no validation overhead    |
| Config objects        | Pydantic     | Environment parsing, validation        |
| Intermediate results  | dataclass    | Simple data containers                 |
| Domain entities       | dataclass    | Business logic, not serialization      |

### DO ✅

```python
from dataclasses import dataclass, field
from typing import Any

# Immutable state container
@dataclass(frozen=True)
class ProcessingPhase:
    name: str
    started_at: float
    metadata: dict[str, Any] = field(default_factory=dict)

# Mutable state with defaults
@dataclass
class PipelineState:
    current_phase: str = "init"
    completed_phases: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    results: dict[str, Any] = field(default_factory=dict)

    def advance_to(self, phase: str) -> None:
        self.completed_phases.append(self.current_phase)
        self.current_phase = phase

    def record_error(self, error: str) -> None:
        self.errors.append(error)

# Using dataclass with async operations
@dataclass
class TranscriptResult:
    text: str
    source: str  # "youtube" | "whisper" | "cached"
    duration_seconds: float
    segments: list[dict] = field(default_factory=list)

async def get_transcript(video_id: str) -> TranscriptResult:
    # ... fetch logic
    return TranscriptResult(
        text=transcript_text,
        source="youtube",
        duration_seconds=elapsed,
        segments=segments
    )
```

### DON'T ❌

```python
# Don't use dataclass for API boundaries
@dataclass
class UserRequest:  # No validation! Use Pydantic
    email: str
    age: int

# Don't use mutable default arguments
@dataclass
class BadDefaults:
    items: list = []  # WRONG - shared between instances!

# Don't over-use frozen when mutation is needed
@dataclass(frozen=True)
class BuilderState:  # Can't update state incrementally
    items: list[str]
```

---

## Parallel Processing with Error Recovery

Using `asyncio.gather` and `asyncio.TaskGroup` for concurrent operations.

### DO ✅

```python
import asyncio
from typing import TypeVar

T = TypeVar("T")

# Basic parallel execution
async def fetch_all_parallel():
    user, orders, prefs = await asyncio.gather(
        fetch_user(user_id),
        fetch_orders(user_id),
        fetch_preferences(user_id),
    )
    return user, orders, prefs

# With error recovery - continue on partial failure
async def fetch_with_recovery() -> dict[str, Any]:
    results = await asyncio.gather(
        fetch_user(user_id),
        fetch_orders(user_id),
        fetch_preferences(user_id),
        return_exceptions=True,  # Don't raise, return exceptions
    )

    user, orders, prefs = results

    # Handle partial failures
    return {
        "user": user if not isinstance(user, Exception) else None,
        "orders": orders if not isinstance(orders, Exception) else [],
        "preferences": prefs if not isinstance(prefs, Exception) else {},
        "errors": [str(r) for r in results if isinstance(r, Exception)],
    }

# Named tasks for debugging
async def process_with_named_tasks():
    tasks = [
        asyncio.create_task(process_chunk(chunk), name=f"chunk_{i}")
        for i, chunk in enumerate(chunks)
    ]

    done, pending = await asyncio.wait(tasks, timeout=30.0)

    for task in pending:
        logger.warning(f"Task {task.get_name()} timed out")
        task.cancel()

    return [task.result() for task in done if not task.cancelled()]

# Python 3.11+ TaskGroup for structured concurrency
async def process_with_taskgroup():
    results = []
    async with asyncio.TaskGroup() as tg:
        for chunk in chunks:
            task = tg.create_task(process_chunk(chunk))
            results.append(task)
    # All tasks complete or all cancelled on first exception
    return [task.result() for task in results]

# Semaphore for rate limiting parallel work
async def process_with_limit(items: list[str], max_concurrent: int = 5):
    semaphore = asyncio.Semaphore(max_concurrent)

    async def limited_process(item: str):
        async with semaphore:
            return await process_item(item)

    return await asyncio.gather(*[limited_process(item) for item in items])
```

### DON'T ❌

```python
# Don't create unbounded concurrent tasks
async def unbounded_parallel(items: list[str]):
    # Could be thousands of concurrent requests!
    return await asyncio.gather(*[process(item) for item in items])

# Don't ignore exceptions in gather results
async def dangerous_gather():
    results = await asyncio.gather(a(), b(), c(), return_exceptions=True)
    return results  # May contain Exception objects!

# Don't forget to handle task cancellation
async def leaky_tasks():
    tasks = [asyncio.create_task(work()) for _ in range(10)]
    try:
        return await asyncio.gather(*tasks)
    except Exception:
        # Tasks still running! Need to cancel them
        pass
```

---

## Pipeline Composition

Chaining async generators and orchestrating multi-phase processing.

### DO ✅

```python
from typing import AsyncGenerator, TypeVar

T = TypeVar("T")
U = TypeVar("U")

# Chain generators into a pipeline
async def chain_generators(
    *generators: AsyncGenerator[T, None]
) -> AsyncGenerator[T, None]:
    for gen in generators:
        async for item in gen:
            yield item

# Transform pipeline stage
async def transform_stage(
    source: AsyncGenerator[T, None],
    transform: Callable[[T], U],
) -> AsyncGenerator[U, None]:
    async for item in source:
        yield transform(item)

# Multi-phase orchestration with state
@dataclass
class PipelineContext:
    video_id: str
    state: PipelineState = field(default_factory=PipelineState)
    results: dict[str, Any] = field(default_factory=dict)

async def orchestrate_pipeline(
    ctx: PipelineContext,
) -> AsyncGenerator[str | PipelineResult, None]:
    """Multi-phase pipeline with progress reporting."""

    # Phase 1: Fetch
    ctx.state.advance_to("fetch")
    yield f"Fetching video {ctx.video_id}..."

    video = await fetch_video(ctx.video_id)
    ctx.results["video"] = video

    # Phase 2: Transcript
    ctx.state.advance_to("transcript")
    yield "Extracting transcript..."

    transcript = await get_transcript(video)
    ctx.results["transcript"] = transcript

    # Phase 3: Analysis (streaming sub-results)
    ctx.state.advance_to("analysis")
    async for progress in analyze_transcript(transcript):
        yield progress

    # Final result
    ctx.state.advance_to("complete")
    yield PipelineResult(
        video_id=ctx.video_id,
        summary=ctx.results.get("summary"),
        phases_completed=ctx.state.completed_phases,
    )

# Collecting intermediate results while streaming
async def stream_with_collection(
    source: AsyncGenerator[str | FinalResult, None]
) -> tuple[list[str], FinalResult]:
    """Collect progress messages and return final result."""
    progress_messages = []
    final_result = None

    async for item in source:
        if isinstance(item, str):
            progress_messages.append(item)
            yield item  # Forward to consumer
        else:
            final_result = item

    return progress_messages, final_result
```

### DON'T ❌

```python
# Don't process generators eagerly when you could stream
async def eager_pipeline():
    items = [item async for item in source()]  # Loads all into memory
    return [transform(item) for item in items]  # Process after loading

# Don't lose the generator context
async def broken_chain():
    gen = source_generator()
    # Lost reference to original generator - can't close it!
    return transform_generator(gen)

# Don't forget error propagation in pipelines
async def silent_failure_pipeline():
    try:
        async for item in source():
            yield transform(item)
    except Exception:
        pass  # Swallowed! Consumer never knows
```

---

## Common Patterns Summary

| Pattern                  | When to Use                             | Key Function                          |
| ------------------------ | --------------------------------------- | ------------------------------------- |
| Async Generator          | Streaming, incremental processing       | `async def f() -> AsyncGenerator`     |
| gather + return_exc      | Parallel with partial failure tolerance | `asyncio.gather(..., return_exc=True)` |
| Semaphore                | Rate-limited parallel processing        | `asyncio.Semaphore(n)`                |
| TaskGroup                | Structured concurrency (3.11+)          | `async with TaskGroup()`              |
| Named tasks              | Debugging, timeout handling             | `create_task(..., name="...")`        |
| Dataclass state          | Pipeline/phase tracking                 | `@dataclass`                          |
| Pipeline composition     | Multi-stage streaming                   | Generator chaining                    |
