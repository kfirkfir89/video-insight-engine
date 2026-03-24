# AI Integration

LLM calls via LiteLLM — unified API, streaming, tools, fallbacks, and cost tracking.

<rules>
- ALWAYS use LiteLLM `acompletion()` for async LLM calls with `provider/model` format (separate SDKs per provider create unmaintainable code paths)
- ALWAYS set timeouts and `num_retries` on LLM calls (LLM APIs have variable latency; calls without timeouts can hang indefinitely)
- ALWAYS configure fallback models for production reliability (single-provider dependency means provider outages take down your service)
- ALWAYS track costs with `completion_cost()` or success callbacks (untracked LLM costs grow silently and can cause budget overruns)
- NEVER use sync `completion()` in async code — use `acompletion()` (sync calls block the event loop for all concurrent requests)
- NEVER hardcode API keys — use environment variables via Pydantic Settings (hardcoded keys leak via version control)
- NEVER build manual retry loops — use LiteLLM's built-in `num_retries` and `fallbacks` (manual retry logic duplicates built-in functionality and misses edge cases)
</rules>

---

## Basic Completion

```python
from litellm import acompletion

async def complete(prompt: str, model: str = "anthropic/claude-sonnet-4-20250514") -> str:
    response = await acompletion(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1000, temperature=0.7,
        num_retries=2, timeout=30.0,
    )
    return response.choices[0].message.content or ""
```

---

## Streaming

```python
async def stream_completion(messages: list[dict], model: str) -> AsyncGenerator[str, None]:
    response = await acompletion(
        model=model, messages=messages, stream=True,
    )
    async for chunk in response:
        content = chunk.choices[0].delta.content
        if content:
            yield content
```

For SSE endpoints, wrap in `StreamingResponse` with `media_type="text/event-stream"` and headers `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

---

## Fallbacks & Error Handling

```python
async def complete_with_fallback(prompt: str) -> str:
    response = await acompletion(
        model="anthropic/claude-sonnet-4-20250514",
        messages=[{"role": "user", "content": prompt}],
        fallbacks=["openai/gpt-4o", "gemini/gemini-1.5-pro"],
        num_retries=2, timeout=30.0,
    )
    return response.choices[0].message.content or ""
```

Handle specific exceptions: `RateLimitError` (429, use fallback), `AuthenticationError` (bad key), `Timeout` (reduce tokens or retry), `ServiceUnavailableError` (provider down, use fallback).

---

## Cost Tracking

```python
from litellm import completion_cost

cost = completion_cost(completion_response=response)
usage = UsageRecord(
    model=model, input_tokens=response.usage.prompt_tokens,
    output_tokens=response.usage.completion_tokens, cost_usd=cost,
)
```

For automatic tracking, register `litellm.success_callback` with a function that logs to your database.

---

## Structured Output

Use Instructor with LiteLLM for Pydantic-validated structured responses.

```python
import instructor
from litellm import acompletion

client = instructor.from_litellm(acompletion)

async def extract(text: str) -> ExtractedData:
    return await client(
        model="anthropic/claude-sonnet-4-20250514",
        response_model=ExtractedData,
        max_retries=3,
        messages=[{"role": "user", "content": f"Extract from:\n\n{text}"}],
    )
```

---

## Function Calling / Tools

Use LiteLLM's unified tools interface. Define tools as OpenAI-format dicts. Loop until `message.tool_calls` is None, executing tools and appending results.

---

## Configuration

```python
class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str | None = None
    LLM_MODEL: str = "anthropic/claude-sonnet-4-20250514"
    LLM_FALLBACK_MODEL: str | None = "openai/gpt-4o"
    LLM_TIMEOUT: float = 30.0
```

Model format: `provider/model-name` (e.g., `anthropic/claude-sonnet-4-20250514`, `openai/gpt-4o`, `gemini/gemini-1.5-pro`).

---

## Edge Cases

- **Streaming with usage stats**: Pass `stream_options={"include_usage": True}` to get token counts in the final chunk.
- **LiteLLM Router**: Use `Router` with `model_list` for load balancing across multiple deployments of the same model with different API keys.
- **Migration from direct SDK**: Replace `client.messages.create(model="claude-sonnet-4-20250514")` with `acompletion(model="anthropic/claude-sonnet-4-20250514")`. Response format changes from `.content[0].text` to `.choices[0].message.content`.

---

## Rules Summary

Use LiteLLM `acompletion()` for all LLM calls with `provider/model` format. Always set timeouts, retries, and fallback models. Stream with `stream=True` and serve via SSE. Track costs with `completion_cost()`. Use Instructor for structured Pydantic output. Handle provider-specific errors with fallbacks. Load API keys from environment, never hardcode. Use the Router for load balancing multiple deployments.
