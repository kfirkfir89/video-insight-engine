# AI Integration (Python)

Core patterns for calling LLMs - unified API with LiteLLM, streaming, tools, and production essentials.

---

## LiteLLM Setup (Recommended)

LiteLLM provides a unified OpenAI-compatible API for 100+ providers with built-in fallbacks, retries, and cost tracking.

### DO ✅

```python
# lib/ai/provider.py
from litellm import acompletion, completion_cost
from litellm.exceptions import (
    RateLimitError,
    AuthenticationError,
    APIError,
    Timeout,
)
from app.core.config import settings
from pydantic import BaseModel
from typing import Literal


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class CompletionOptions(BaseModel):
    model: str = "anthropic/claude-sonnet-4-20250514"  # provider/model format
    max_tokens: int = 1000
    temperature: float = 0.7


# Model name format: provider/model-name
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
        "default": "gemini/gemini-1.5-pro",
        "fast": "gemini/gemini-1.5-flash",
    },
}


def get_model(provider: str = "anthropic", tier: str = "default") -> str:
    """Get model name for provider and tier."""
    return MODEL_MAP.get(provider, MODEL_MAP["anthropic"]).get(tier, "default")
```

### DON'T ❌

```python
# Separate SDKs for each provider (harder to maintain)
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from google.generativeai import GenerativeModel

# Different client per provider
if provider == "openai":
    client = AsyncOpenAI()
elif provider == "anthropic":
    client = AsyncAnthropic()
# ... different APIs, different response formats

# Hardcoded model names without provider prefix
model = "claude-sonnet-4-20250514"  # Missing provider prefix!
```

---

## Basic Completion

### DO ✅

```python
# services/ai_service.py
from litellm import acompletion
from lib.ai.provider import Message, CompletionOptions


async def complete(
    prompt: str,
    options: CompletionOptions | None = None,
    system_prompt: str = "You are a helpful assistant.",
) -> str:
    """Generate completion using LiteLLM (any provider)."""
    opts = options or CompletionOptions()

    response = await acompletion(
        model=opts.model,  # e.g., "anthropic/claude-sonnet-4-20250514"
        max_tokens=opts.max_tokens,
        temperature=opts.temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    )

    return response.choices[0].message.content or ""


async def complete_with_messages(
    messages: list[Message],
    options: CompletionOptions | None = None,
) -> str:
    """Chat completion with message history."""
    opts = options or CompletionOptions()

    response = await acompletion(
        model=opts.model,
        max_tokens=opts.max_tokens,
        messages=[m.model_dump() for m in messages],
    )

    return response.choices[0].message.content or ""
```

### DON'T ❌

```python
# Provider-specific code paths
if "claude" in model:
    response = await anthropic_client.messages.create(...)
    return response.content[0].text
else:
    response = await openai_client.chat.completions.create(...)
    return response.choices[0].message.content

# Blocking calls in async context
from litellm import completion  # Sync version!
response = completion(...)  # Blocks event loop!
```

---

## Streaming Responses

### DO ✅

```python
from collections.abc import AsyncGenerator
from litellm import acompletion


async def stream_completion(
    messages: list[Message],
    options: CompletionOptions | None = None,
) -> AsyncGenerator[str, None]:
    """Stream completion from any provider."""
    opts = options or CompletionOptions()

    response = await acompletion(
        model=opts.model,
        max_tokens=opts.max_tokens,
        messages=[m.model_dump() for m in messages],
        stream=True,
    )

    async for chunk in response:
        content = chunk.choices[0].delta.content
        if content:
            yield content


# With token usage in stream
async def stream_with_usage(
    messages: list[Message],
    options: CompletionOptions | None = None,
) -> AsyncGenerator[str | dict, None]:
    """Stream with final usage stats."""
    opts = options or CompletionOptions()

    response = await acompletion(
        model=opts.model,
        messages=[m.model_dump() for m in messages],
        stream=True,
        stream_options={"include_usage": True},  # Get usage in final chunk
    )

    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
        elif chunk.usage:  # Final chunk with usage
            yield {"usage": chunk.usage.model_dump()}
```

### DON'T ❌

```python
# Different streaming APIs per provider
if provider == "anthropic":
    async with client.messages.stream(...) as stream:
        async for text in stream.text_stream:
            yield text
elif provider == "openai":
    stream = await client.chat.completions.create(..., stream=True)
    async for chunk in stream:
        yield chunk.choices[0].delta.content
```

---

## SSE Endpoint (FastAPI)

### DO ✅

```python
# routes/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

router = APIRouter()


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str = "anthropic/claude-sonnet-4-20250514"


async def event_generator(messages: list[Message], model: str):
    """Generate SSE events from LiteLLM stream."""
    try:
        async for chunk in stream_completion(
            messages,
            CompletionOptions(model=model)
        ):
            data = json.dumps({"content": chunk})
            yield f"data: {data}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@router.post("/chat/stream")
async def stream_chat(request: ChatRequest):
    """Stream chat completion via SSE."""
    return StreamingResponse(
        event_generator(request.messages, request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

---

## Error Handling & Fallbacks

### DO ✅

```python
from litellm import acompletion
from litellm.exceptions import (
    RateLimitError,
    AuthenticationError,
    APIError,
    Timeout,
    ServiceUnavailableError,
)
import logging

logger = logging.getLogger(__name__)


async def complete_with_fallback(
    prompt: str,
    primary_model: str = "anthropic/claude-sonnet-4-20250514",
    fallback_model: str = "openai/gpt-4o",
) -> str:
    """Complete with automatic fallback on failure."""
    try:
        response = await acompletion(
            model=primary_model,
            messages=[{"role": "user", "content": prompt}],
            num_retries=2,  # Built-in retries
            timeout=30.0,
        )
        return response.choices[0].message.content or ""

    except (RateLimitError, Timeout, ServiceUnavailableError) as e:
        logger.warning(f"Primary model failed: {e}, trying fallback")

        response = await acompletion(
            model=fallback_model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""


# Using built-in fallbacks parameter
async def complete_with_builtin_fallback(prompt: str) -> str:
    """Use LiteLLM's built-in fallback mechanism."""
    response = await acompletion(
        model="anthropic/claude-sonnet-4-20250514",
        messages=[{"role": "user", "content": prompt}],
        fallbacks=["openai/gpt-4o", "gemini/gemini-1.5-pro"],  # Auto-fallback chain
        num_retries=2,
    )
    return response.choices[0].message.content or ""


# Specific exception handling
async def handle_ai_errors(prompt: str) -> str:
    """Handle specific LiteLLM exceptions."""
    try:
        response = await acompletion(
            model="anthropic/claude-sonnet-4-20250514",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    except RateLimitError as e:
        logger.warning(f"Rate limited by {e.llm_provider}")
        raise AppError("AI rate limit exceeded", 429, "AI_RATE_LIMIT")

    except AuthenticationError as e:
        logger.error(f"Invalid API key for {e.llm_provider}")
        raise AppError("AI authentication failed", 500, "AI_AUTH_ERROR")

    except Timeout as e:
        logger.warning(f"Request timed out after {e.timeout}s")
        raise AppError("AI request timed out", 504, "AI_TIMEOUT")

    except APIError as e:
        logger.error(f"API error: {e.message} (status: {e.status_code})")
        raise AppError("AI service error", 503, "AI_ERROR")
```

### DON'T ❌

```python
# Bare except
try:
    response = await acompletion(...)
except:
    pass  # Silent failure!

# Not using built-in retries
for attempt in range(3):  # Manual retry loop
    try:
        response = await acompletion(...)
        break
    except Exception:
        time.sleep(2 ** attempt)  # LiteLLM does this for you!
```

---

## Cost Tracking

### DO ✅

```python
from litellm import acompletion, completion_cost
from datetime import datetime, UTC
from pydantic import BaseModel


class UsageRecord(BaseModel):
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    timestamp: datetime
    user_id: str | None = None
    feature: str = "unknown"
    request_id: str | None = None


def extract_provider(model: str) -> str:
    """Extract provider from model string."""
    return model.split("/")[0] if "/" in model else "unknown"


async def complete_with_tracking(
    prompt: str,
    model: str = "anthropic/claude-sonnet-4-20250514",
    user_id: str | None = None,
    feature: str = "chat",
) -> tuple[str, UsageRecord]:
    """Complete with automatic cost tracking."""
    response = await acompletion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )

    # LiteLLM calculates cost automatically
    cost = completion_cost(completion_response=response)

    usage = UsageRecord(
        model=model,
        provider=extract_provider(model),
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
        cost_usd=cost,
        timestamp=datetime.now(UTC),
        user_id=user_id,
        feature=feature,
    )

    # Store in database
    await db.llm_usage.insert_one(usage.model_dump())

    return response.choices[0].message.content or "", usage


# Using LiteLLM callbacks for automatic tracking
import litellm


async def track_usage_callback(kwargs, response, start_time, end_time):
    """LiteLLM success callback for usage tracking."""
    cost = kwargs.get("response_cost", 0)

    record = {
        "model": kwargs.get("model"),
        "provider": extract_provider(kwargs.get("model", "")),
        "input_tokens": response.usage.prompt_tokens if response.usage else 0,
        "output_tokens": response.usage.completion_tokens if response.usage else 0,
        "cost_usd": cost,
        "duration_ms": int((end_time - start_time) * 1000),
        "timestamp": datetime.now(UTC),
        "user_id": kwargs.get("metadata", {}).get("user_id"),
        "feature": kwargs.get("metadata", {}).get("feature", "unknown"),
    }

    await db.llm_usage.insert_one(record)


# Register callback globally
litellm.success_callback = [track_usage_callback]
```

### DON'T ❌

```python
# Manual pricing tables (outdated quickly)
PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    # ... maintaining this is painful
}

# Forgetting to track failures
try:
    response = await acompletion(...)
except Exception:
    # Lost visibility into failed requests!
    raise
```

---

## Router for Load Balancing

### DO ✅

```python
from litellm import Router
import os


# Configure router with multiple deployments
router = Router(
    model_list=[
        {
            "model_name": "claude",  # Alias for routing
            "litellm_params": {
                "model": "anthropic/claude-sonnet-4-20250514",
                "api_key": os.environ["ANTHROPIC_API_KEY"],
            },
        },
        {
            "model_name": "gpt",
            "litellm_params": {
                "model": "openai/gpt-4o",
                "api_key": os.environ["OPENAI_API_KEY"],
            },
        },
    ],
    fallbacks=[{"claude": ["gpt"]}],  # claude -> gpt on failure
    num_retries=2,
    timeout=30,
    routing_strategy="simple-shuffle",  # or "least-busy", "latency-based-routing"
)


async def complete_via_router(prompt: str, model_alias: str = "claude") -> str:
    """Route requests through LiteLLM router."""
    response = await router.acompletion(
        model=model_alias,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""
```

---

## Concurrent Provider Calls

### DO ✅

```python
import asyncio
from litellm import acompletion


async def race_providers(prompt: str) -> str:
    """Get fastest response from multiple providers."""
    tasks = [
        acompletion(
            model="anthropic/claude-sonnet-4-20250514",
            messages=[{"role": "user", "content": prompt}],
        ),
        acompletion(
            model="openai/gpt-4o",
            messages=[{"role": "user", "content": prompt}],
        ),
    ]

    # Return first successful response
    done, pending = await asyncio.wait(
        tasks,
        return_when=asyncio.FIRST_COMPLETED,
    )

    # Cancel remaining tasks
    for task in pending:
        task.cancel()

    result = done.pop().result()
    return result.choices[0].message.content or ""


async def aggregate_providers(prompt: str) -> list[str]:
    """Get responses from all providers concurrently."""
    tasks = [
        acompletion(model="anthropic/claude-sonnet-4-20250514", messages=[{"role": "user", "content": prompt}]),
        acompletion(model="openai/gpt-4o", messages=[{"role": "user", "content": prompt}]),
        acompletion(model="gemini/gemini-1.5-pro", messages=[{"role": "user", "content": prompt}]),
    ]

    responses = await asyncio.gather(*tasks, return_exceptions=True)

    return [
        r.choices[0].message.content
        for r in responses
        if not isinstance(r, Exception) and r.choices
    ]
```

---

## Function Calling / Tools

### DO ✅

```python
from litellm import acompletion
import json


tools = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search internal knowledge base",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                },
                "required": ["query"],
            },
        },
    },
]


async def chat_with_tools(messages: list[Message]) -> str:
    """Chat with tool calling (works across providers)."""
    current_messages = [m.model_dump() for m in messages]

    while True:
        response = await acompletion(
            model="anthropic/claude-sonnet-4-20250514",
            messages=current_messages,
            tools=tools,
        )

        message = response.choices[0].message

        if not message.tool_calls:
            return message.content or ""

        current_messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            args = json.loads(tool_call.function.arguments)
            result = await execute_tool(tool_call.function.name, args)

            current_messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })
```

---

## Environment Configuration

### DO ✅

```python
# config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Provider API keys
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None

    # LLM configuration
    LLM_PROVIDER: str = "anthropic"
    LLM_MODEL: str = "anthropic/claude-sonnet-4-20250514"
    LLM_FALLBACK_MODEL: str | None = "openai/gpt-4o"
    LLM_MAX_TOKENS: int = 4096
    LLM_TIMEOUT: float = 30.0

    class Config:
        env_file = ".env"


settings = Settings()
```

```bash
# .env
LLM_PROVIDER=anthropic
LLM_MODEL=anthropic/claude-sonnet-4-20250514
LLM_FALLBACK_MODEL=openai/gpt-4o

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

### DON'T ❌

```python
# Hardcoded keys
ANTHROPIC_API_KEY = "sk-ant-api03-..."

# No fallback configuration
LLM_MODEL = "anthropic/claude-sonnet-4-20250514"  # What if Anthropic is down?
```

---

## Structured Output with Instructor

For simple structured output (without full agents), use Instructor with LiteLLM:

### DO ✅

```python
# services/extraction_service.py
import instructor
from litellm import acompletion
from pydantic import BaseModel


# Patch LiteLLM with Instructor
client = instructor.from_litellm(acompletion)


class ExtractedData(BaseModel):
    """Structured extraction output."""
    title: str
    summary: str
    key_points: list[str]
    sentiment: str


async def extract_structured(text: str) -> ExtractedData:
    """Extract structured data from text using Instructor."""
    return await client(
        model="anthropic/claude-sonnet-4-20250514",
        response_model=ExtractedData,
        messages=[
            {"role": "user", "content": f"Extract information from:\n\n{text}"},
        ],
    )


# With retries for validation failures
class UserInfo(BaseModel):
    name: str
    email: str
    age: int


async def extract_user_info(text: str) -> UserInfo:
    """Extract user info with automatic retries on validation failure."""
    return await client(
        model="anthropic/claude-sonnet-4-20250514",
        response_model=UserInfo,
        max_retries=3,  # Retry on validation failure
        messages=[
            {"role": "user", "content": f"Extract user info from:\n\n{text}"},
        ],
    )
```

### When to Use What

| Need | Use | Why |
|------|-----|-----|
| Simple structured output | **Instructor** | Lightweight, just Pydantic validation |
| Agents with tools | **PydanticAI** | Full agent framework with DI |
| Raw LLM calls | **LiteLLM** | Unified provider API |

---

## Quick Reference

| Pattern              | When to Use                          |
| -------------------- | ------------------------------------ |
| `acompletion`        | Single async completion              |
| `stream=True`        | Chat UI, long responses              |
| `fallbacks=[...]`    | Production reliability               |
| `Router`             | Load balancing, multiple deployments |
| `completion_cost()`  | Track spending                       |
| `success_callback`   | Automatic usage logging              |
| `instructor.from_litellm()` | Structured output with validation |

| Model Format                            | Example                       |
| --------------------------------------- | ----------------------------- |
| Anthropic                               | `anthropic/claude-sonnet-4-20250514` |
| OpenAI                                  | `openai/gpt-4o`               |
| Google                                  | `gemini/gemini-1.5-pro`       |
| Azure OpenAI                            | `azure/gpt-4-deployment`      |

| Exception              | Meaning                    | Action                     |
| ---------------------- | -------------------------- | -------------------------- |
| `RateLimitError`       | Provider rate limit hit    | Use fallback, wait & retry |
| `AuthenticationError`  | Invalid API key            | Check environment config   |
| `Timeout`              | Request took too long      | Reduce tokens, retry       |
| `ServiceUnavailableError` | Provider is down        | Use fallback provider      |
| `APIError`             | General API error          | Log and retry              |

---

## Migration from Direct SDK

If migrating from direct Anthropic/OpenAI SDK usage:

```python
# BEFORE (Anthropic SDK)
from anthropic import AsyncAnthropic
client = AsyncAnthropic()
response = await client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
)
result = response.content[0].text

# AFTER (LiteLLM)
from litellm import acompletion
response = await acompletion(
    model="anthropic/claude-sonnet-4-20250514",  # Add provider prefix
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
)
result = response.choices[0].message.content  # OpenAI-compatible format
```
