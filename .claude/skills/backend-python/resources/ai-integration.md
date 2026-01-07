# AI Integration (Python)

Core patterns for calling LLMs - SDK setup, streaming, tools, and production essentials.

---

## SDK Setup

### DO ✅

```python
# lib/ai/clients.py
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from app.core.config import settings

_openai_client: AsyncOpenAI | None = None
_anthropic_client: AsyncAnthropic | None = None


def get_openai() -> AsyncOpenAI:
    """Get singleton OpenAI client."""
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=30.0,
            max_retries=2,
        )
    return _openai_client


def get_anthropic() -> AsyncAnthropic:
    """Get singleton Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
        )
    return _anthropic_client


# Types
from pydantic import BaseModel
from typing import Literal


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class CompletionOptions(BaseModel):
    model: str = "gpt-4o"
    max_tokens: int = 1000
    temperature: float = 0.7
    system_prompt: str = "You are a helpful assistant."
```

### DON'T ❌

```python
# New client per request (wasteful)
@router.post("/chat")
async def chat(request: ChatRequest):
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Hardcoded keys
client = AsyncOpenAI(api_key="sk-...")
```

---

## Basic Completion

### DO ✅

```python
# services/ai_service.py
from lib.ai.clients import get_openai, get_anthropic, Message, CompletionOptions


async def complete(
    prompt: str,
    options: CompletionOptions | None = None
) -> str:
    """Generate completion from prompt."""
    opts = options or CompletionOptions()
    client = get_openai()

    response = await client.chat.completions.create(
        model=opts.model,
        max_tokens=opts.max_tokens,
        temperature=opts.temperature,
        messages=[
            {"role": "system", "content": opts.system_prompt},
            {"role": "user", "content": prompt},
        ],
    )

    return response.choices[0].message.content or ""


async def complete_claude(
    prompt: str,
    options: CompletionOptions | None = None
) -> str:
    """Generate completion using Claude."""
    opts = options or CompletionOptions()
    client = get_anthropic()

    response = await client.messages.create(
        model=opts.model if "claude" in opts.model else "claude-sonnet-4-20250514",
        max_tokens=opts.max_tokens,
        system=opts.system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text if response.content else ""
```

---

## Streaming Responses

### DO ✅

```python
from collections.abc import AsyncGenerator


async def stream_completion(
    messages: list[Message],
    options: CompletionOptions | None = None
) -> AsyncGenerator[str, None]:
    """Stream OpenAI completion."""
    opts = options or CompletionOptions()
    client = get_openai()

    stream = await client.chat.completions.create(
        model=opts.model,
        max_tokens=opts.max_tokens,
        messages=[m.model_dump() for m in messages],
        stream=True,
    )

    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content


async def stream_claude_completion(
    messages: list[Message],
) -> AsyncGenerator[str, None]:
    """Stream Claude completion."""
    client = get_anthropic()

    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[m.model_dump() for m in messages],
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

---

## SSE Endpoint (FastAPI)

### DO ✅

```python
# routes/chat.py
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

router = APIRouter()


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str = "gpt-4o"


async def event_generator(messages: list[Message], model: str):
    """Generate SSE events."""
    try:
        async for chunk in stream_completion(messages, CompletionOptions(model=model)):
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

## Structured Output (JSON Mode)

### DO ✅

```python
from pydantic import BaseModel, Field


class ExtractedData(BaseModel):
    """Schema for extracted data."""
    title: str
    summary: str
    key_points: list[str]
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float = Field(ge=0, le=1)


async def extract_structured(text: str) -> ExtractedData:
    """Extract structured data using JSON mode."""
    client = get_openai()

    response = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Extract structured data from the text."},
            {"role": "user", "content": text},
        ],
        response_format=ExtractedData,
    )

    return response.choices[0].message.parsed


# Alternative: Manual JSON parsing
async def extract_json(text: str, schema: dict) -> dict:
    """Extract JSON with schema validation."""
    client = get_openai()

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": f"Extract JSON matching this schema: {json.dumps(schema)}",
            },
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)
```

---

## Function Calling / Tools

### DO ✅

```python
from typing import Callable, Any

# Define tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search internal knowledge base for relevant information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "number", "description": "Max results (default 5)"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    },
]


# Tool handlers
async def search_knowledge_base(query: str, limit: int = 5) -> str:
    results = await knowledge_service.search(query, limit)
    return json.dumps(results)


async def get_current_weather(location: str, unit: str = "celsius") -> str:
    weather = await weather_service.get(location, unit)
    return json.dumps(weather)


tool_handlers: dict[str, Callable[..., Any]] = {
    "search_knowledge_base": search_knowledge_base,
    "get_current_weather": get_current_weather,
}


async def chat_with_tools(messages: list[Message]) -> str:
    """Chat with tool calling support."""
    client = get_openai()
    current_messages = [m.model_dump() for m in messages]

    while True:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=current_messages,
            tools=tools,
        )

        message = response.choices[0].message

        # No tool calls - return final response
        if not message.tool_calls:
            return message.content or ""

        # Execute tool calls
        current_messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            handler = tool_handlers.get(tool_call.function.name)
            if not handler:
                raise ValueError(f"Unknown tool: {tool_call.function.name}")

            args = json.loads(tool_call.function.arguments)
            result = await handler(**args)

            current_messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })
```

---

## Error Handling & Fallbacks

### DO ✅

```python
from openai import APIError, RateLimitError, APITimeoutError
import asyncio
from dataclasses import dataclass


@dataclass
class AIConfig:
    primary: dict[str, str]  # {"provider": "openai", "model": "gpt-4o"}
    fallback: dict[str, str] | None = None


default_config = AIConfig(
    primary={"provider": "openai", "model": "gpt-4o"},
    fallback={"provider": "anthropic", "model": "claude-sonnet-4-20250514"},
)


async def safe_complete(
    prompt: str,
    config: AIConfig = default_config
) -> str:
    """Complete with fallback support."""
    try:
        return await complete_with_provider(prompt, config.primary)
    except Exception as error:
        logger.warning(f"Primary AI failed: {error}, trying fallback")

        if config.fallback:
            try:
                return await complete_with_provider(prompt, config.fallback)
            except Exception as fallback_error:
                logger.error(f"Fallback AI also failed: {fallback_error}")

        # Handle specific errors
        if isinstance(error, RateLimitError):
            raise AppError("AI rate limit exceeded", 429, "AI_RATE_LIMIT")
        if isinstance(error, APITimeoutError):
            raise AppError("AI request timed out", 504, "AI_TIMEOUT")
        if isinstance(error, APIError) and error.status_code == 401:
            raise AppError("AI authentication failed", 500, "AI_AUTH_ERROR")

        raise AppError("AI service unavailable", 503, "AI_ERROR")


async def complete_with_provider(prompt: str, config: dict[str, str]) -> str:
    """Complete using specified provider."""
    if config["provider"] == "anthropic":
        return await complete_claude(prompt, CompletionOptions(model=config["model"]))
    return await complete(prompt, CompletionOptions(model=config["model"]))
```

---

## Token Management

### DO ✅

```python
import tiktoken
from functools import lru_cache


@lru_cache(maxsize=10)
def get_encoder(model: str):
    """Get cached encoder for model."""
    return tiktoken.encoding_for_model(model)


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """Count tokens in text."""
    encoder = get_encoder(model)
    return len(encoder.encode(text))


def count_messages_tokens(messages: list[Message], model: str = "gpt-4o") -> int:
    """Count tokens in messages."""
    total = 0
    for msg in messages:
        total += count_tokens(msg.content, model)
        total += 4  # Role + formatting overhead
    return total + 2  # Priming tokens


def truncate_to_fit(
    messages: list[Message],
    max_tokens: int,
    model: str = "gpt-4o"
) -> list[Message]:
    """Truncate messages to fit token limit."""
    result: list[Message] = []
    current_tokens = 0

    # Always keep system message
    system_msg = next((m for m in messages if m.role == "system"), None)
    if system_msg:
        current_tokens += count_tokens(system_msg.content, model) + 4
        result.append(system_msg)

    # Add messages from most recent
    other_msgs = [m for m in messages if m.role != "system"]

    for msg in reversed(other_msgs):
        msg_tokens = count_tokens(msg.content, model) + 4
        if current_tokens + msg_tokens > max_tokens:
            break
        current_tokens += msg_tokens
        result.insert(1 if system_msg else 0, msg)

    return result
```

---

## Cost Tracking

### DO ✅

```python
from datetime import datetime, UTC
from pydantic import BaseModel


# Pricing per 1M tokens
PRICING: dict[str, dict[str, float]] = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
}


class UsageRecord(BaseModel):
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    timestamp: datetime
    user_id: str | None = None
    request_id: str | None = None


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost for token usage."""
    pricing = PRICING.get(model)
    if not pricing:
        return 0.0

    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]

    return input_cost + output_cost


async def track_usage(usage: UsageRecord) -> None:
    """Track AI usage."""
    await db.ai_usage.insert_one(usage.model_dump())

    # Alert on high usage
    daily_total = await get_daily_usage(usage.user_id)
    if daily_total > settings.AI_DAILY_COST_LIMIT:
        await alert_service.send("AI cost limit exceeded", {"usage": usage.model_dump()})


async def completion_with_tracking(
    prompt: str,
    user_id: str | None = None,
    request_id: str | None = None,
    options: CompletionOptions | None = None,
) -> tuple[str, UsageRecord]:
    """Complete with usage tracking."""
    opts = options or CompletionOptions()
    client = get_openai()

    response = await client.chat.completions.create(
        model=opts.model,
        max_tokens=opts.max_tokens,
        messages=[
            {"role": "system", "content": opts.system_prompt},
            {"role": "user", "content": prompt},
        ],
    )

    usage = UsageRecord(
        model=opts.model,
        input_tokens=response.usage.prompt_tokens if response.usage else 0,
        output_tokens=response.usage.completion_tokens if response.usage else 0,
        cost=calculate_cost(
            opts.model,
            response.usage.prompt_tokens if response.usage else 0,
            response.usage.completion_tokens if response.usage else 0,
        ),
        timestamp=datetime.now(UTC),
        user_id=user_id,
        request_id=request_id,
    )

    await track_usage(usage)

    return response.choices[0].message.content or "", usage
```

---

## Multi-Modal (Images)

### DO ✅

```python
import base64
from pydantic import BaseModel
from typing import Literal


class ImageInput(BaseModel):
    type: Literal["url", "base64"]
    data: str
    media_type: str = "image/jpeg"


async def analyze_image(image: ImageInput, prompt: str) -> str:
    """Analyze image with vision model."""
    client = get_openai()

    if image.type == "url":
        image_content = {"type": "image_url", "image_url": {"url": image.data}}
    else:
        image_content = {
            "type": "image_url",
            "image_url": {"url": f"data:{image.media_type};base64,{image.data}"},
        }

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    image_content,
                ],
            },
        ],
        max_tokens=1000,
    )

    return response.choices[0].message.content or ""
```

---

## Quick Reference

| Pattern           | When to Use                      |
| ----------------- | -------------------------------- |
| Basic Completion  | Simple Q&A, summarization        |
| Streaming         | Chat UI, long responses          |
| Structured Output | Data extraction, parsing         |
| Function Calling  | External actions, data retrieval |
| Fallbacks         | Production reliability           |
| Token Management  | Long conversations, cost control |

| Error   | Action                          |
| ------- | ------------------------------- |
| 401     | Check API key configuration     |
| 429     | Use fallback, implement backoff |
| 500+    | Retry with exponential backoff  |
| Timeout | Reduce tokens, increase timeout |
