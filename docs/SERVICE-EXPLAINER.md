# Service: vie-explainer

Python MCP server with explain tools.

**Type:** MCP Server

---

## Tech Stack

| Technology   | Purpose        |
| ------------ | -------------- |
| Python 3.11+ | Runtime        |
| mcp          | MCP Server SDK |
| LiteLLM      | Multi-provider LLM abstraction (Anthropic, OpenAI, Gemini) |
| pymongo      | MongoDB driver |
| Pydantic     | Validation     |

---

## MCP Tools

| Tool           | Purpose                  | Cached? |
| -------------- | ------------------------ | ------- |
| `explain_auto` | Generate documentation   | ✅ Yes  |
| `explain_chat` | Interactive conversation | ❌ No   |

---

## Project Structure

```
services/explainer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── main.py                   # FastAPI app + SSE endpoints
    ├── config.py                 # Settings + model mapping
    │
    ├── tools/
    │   ├── explain_auto.py       # Cached expansion
    │   └── explain_chat.py       # Interactive chat
    │
    ├── services/
    │   ├── llm.py                # LLM service (prompts + orchestration)
    │   ├── llm_provider.py       # LiteLLM abstraction layer
    │   ├── usage_tracker.py      # LLM usage tracking
    │   ├── cache.py              # Cache operations
    │   └── mongodb.py            # Database operations
    │
    └── prompts/
        ├── explain_section.txt
        ├── explain_concept.txt
        └── chat_system.txt
```

---

## Environment Variables

```bash
# Database
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine

# LLM Provider Configuration
LLM_PROVIDER=anthropic          # anthropic, openai, or gemini
LLM_FAST_PROVIDER=              # Optional: separate provider for fast model
LLM_FALLBACK_PROVIDER=          # Optional: fallback if primary fails
LLM_MODEL=                      # Optional: override default model
LLM_FAST_MODEL=                 # Optional: override fast model
LLM_MAX_TOKENS=4096
LLM_FAST_MAX_TOKENS=2048

# Provider API Keys (set for providers you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=                 # Required if using OpenAI
GOOGLE_API_KEY=                 # Required if using Gemini

LOG_LEVEL=debug
```

---

## MCP Server Implementation

### Entry Point

```python
# src/server.py

from mcp.server import Server
from mcp.server.stdio import stdio_server

from tools.explain_auto import explain_auto
from tools.explain_chat import explain_chat

server = Server("vie-explainer")

@server.tool()
async def explain_auto_tool(
    videoSummaryId: str,
    targetType: str,
    targetId: str
) -> str:
    """
    Generate detailed documentation for a video section or concept.
    Results are cached and reused across all users.

    Args:
        videoSummaryId: ID of videoSummaryCache entry
        targetType: "section" or "concept"
        targetId: UUID of the section or concept

    Returns:
        Markdown documentation
    """
    return await explain_auto(videoSummaryId, targetType, targetId)

@server.tool()
async def explain_chat_tool(
    memorizedItemId: str,
    userId: str,
    message: str,
    chatId: str | None = None
) -> str:
    """
    Interactive conversation about a memorized item.
    Personalized per user, not cached.

    Args:
        memorizedItemId: ID of the memorized item
        userId: ID of the user
        message: User's message
        chatId: Optional - continue existing chat

    Returns:
        JSON string: { "response": "...", "chatId": "..." }
    """
    result = await explain_chat(memorizedItemId, userId, message, chatId)
    return json.dumps(result)

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

---

## Tool: explain_auto

### Implementation

```python
# src/tools/explain_auto.py

import uuid
from datetime import datetime
from bson import ObjectId

from services.mongodb import db
from services.llm import generate_expansion
from config import settings

async def explain_auto(
    video_summary_id: str,
    target_type: str,
    target_id: str
) -> str:
    """Generate cached expansion for section/concept."""

    # 1. Check cache
    cached = db.systemExpansionCache.find_one({
        'videoSummaryId': ObjectId(video_summary_id),
        'targetType': target_type,
        'targetId': target_id,
        'status': 'completed'
    })

    if cached:
        return cached['content']

    # 2. Load source from videoSummaryCache
    video_summary = db.videoSummaryCache.find_one({
        '_id': ObjectId(video_summary_id)
    })

    if not video_summary:
        raise ValueError("Video summary not found")

    # 3. Find target
    if target_type == 'section':
        target = next(
            (s for s in video_summary['summary']['sections'] if s['id'] == target_id),
            None
        )
        if not target:
            raise ValueError("Section not found")

        context = {
            'videoTitle': video_summary['title'],
            'youtubeId': video_summary['youtubeId'],
            'timestamp': target['timestamp'],
            'title': target['title'],
            'summary': target['summary'],
            'bullets': target['bullets']
        }
        prompt_template = 'explain_section.txt'

    else:  # concept
        target = next(
            (c for c in video_summary['summary']['concepts'] if c['id'] == target_id),
            None
        )
        if not target:
            raise ValueError("Concept not found")

        context = {
            'videoTitle': video_summary['title'],
            'youtubeId': video_summary['youtubeId'],
            'name': target['name'],
            'definition': target.get('definition', '')
        }
        prompt_template = 'explain_concept.txt'

    # 4. Generate with LLM
    content = await generate_expansion(prompt_template, context)

    # 5. Save to cache
    db.systemExpansionCache.insert_one({
        'videoSummaryId': ObjectId(video_summary_id),
        'targetType': target_type,
        'targetId': target_id,
        'context': context,
        'content': content,
        'status': 'completed',
        'version': 1,
        'model': settings.ANTHROPIC_MODEL,
        'generatedAt': datetime.utcnow(),
        'createdAt': datetime.utcnow()
    })

    return content
```

### Prompts

```text
# prompts/explain_section.txt

You are creating detailed documentation for a video section.

VIDEO: {videoTitle}
SECTION: {title} ({timestamp})

SUMMARY:
{summary}

KEY POINTS:
{bullets}

---

Generate comprehensive documentation that:

1. **Explains the concepts** in depth with clear language
2. **Provides practical examples** that demonstrate usage
3. **Includes code snippets** if relevant (with comments)
4. **Connects to related concepts** the viewer should know
5. **Adds tips and best practices** from real-world experience

Format as clean Markdown with:
- Clear headings
- Code blocks with syntax highlighting
- Bullet points for lists
- Bold for key terms

Be thorough but focused. Aim for 500-1000 words.
```

```text
# prompts/explain_concept.txt

You are creating detailed documentation for a concept.

VIDEO: {videoTitle}
CONCEPT: {name}
DEFINITION: {definition}

---

Generate comprehensive documentation that:

1. **Defines the concept** clearly and precisely
2. **Explains why it matters** and when to use it
3. **Provides examples** showing it in action
4. **Shows code** if it's a technical concept
5. **Lists common mistakes** to avoid
6. **Connects to related concepts**

Format as clean Markdown. Be thorough but focused.
```

---

## Tool: explain_chat

### Implementation

```python
# src/tools/explain_chat.py

import json
from datetime import datetime
from bson import ObjectId

from services.mongodb import db
from services.llm import chat_completion
from config import settings

async def explain_chat(
    memorized_item_id: str,
    user_id: str,
    message: str,
    chat_id: str | None = None
) -> dict:
    """Interactive chat about memorized item."""

    # 1. Load memorized item
    item = db.memorizedItems.find_one({
        '_id': ObjectId(memorized_item_id),
        'userId': ObjectId(user_id)
    })

    if not item:
        raise ValueError("Memorized item not found or unauthorized")

    # 2. Load or create chat
    if chat_id:
        chat = db.userChats.find_one({
            '_id': ObjectId(chat_id),
            'userId': ObjectId(user_id)
        })
        if not chat:
            raise ValueError("Chat not found")
    else:
        chat = {
            '_id': ObjectId(),
            'userId': ObjectId(user_id),
            'memorizedItemId': ObjectId(memorized_item_id),
            'messages': [],
            'title': None,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        db.userChats.insert_one(chat)

    # 3. Build messages for LLM
    system_prompt = build_system_prompt(item)

    messages = []
    for msg in chat['messages']:
        messages.append({
            'role': msg['role'],
            'content': msg['content']
        })

    messages.append({
        'role': 'user',
        'content': message
    })

    # 4. Call LLM
    response = await chat_completion(system_prompt, messages)

    # 5. Save to chat
    now = datetime.utcnow()
    db.userChats.update_one(
        {'_id': chat['_id']},
        {
            '$push': {
                'messages': {
                    '$each': [
                        {'role': 'user', 'content': message, 'createdAt': now},
                        {'role': 'assistant', 'content': response, 'createdAt': now}
                    ]
                }
            },
            '$set': {'updatedAt': now}
        }
    )

    return {
        'response': response,
        'chatId': str(chat['_id'])
    }

def build_system_prompt(item: dict) -> str:
    """Build system prompt from memorized item."""

    content_parts = []

    source = item['source']
    content = source.get('content', {})

    if 'sections' in content:
        for section in content['sections']:
            content_parts.append(f"## {section['title']} ({section['timestamp']})")
            content_parts.append(section['summary'])
            content_parts.append("Key points:")
            for bullet in section['bullets']:
                content_parts.append(f"- {bullet}")
            content_parts.append("")

    if 'concept' in content:
        concept = content['concept']
        content_parts.append(f"## Concept: {concept['name']}")
        content_parts.append(concept.get('definition', ''))

    if 'expansion' in content:
        content_parts.append("## Explained Content")
        content_parts.append(content['expansion'])

    content_text = "\n".join(content_parts)
    notes = item.get('notes', 'None')

    return f"""You are a helpful tutor discussing content the user has saved.

SAVED CONTENT:
Title: {item['title']}
Source Video: {source['videoTitle']}
YouTube: {source['youtubeUrl']}

---

{content_text}

---

USER'S NOTES:
{notes}

---

Help the user understand this content deeply:
- Answer questions clearly and thoroughly
- Provide practical examples
- Add code snippets when relevant
- Make connections to related concepts
- Be conversational and supportive"""
```

---

## LLM Service (LiteLLM Multi-Provider)

```python
# src/services/llm_provider.py
from litellm import acompletion
from src.config import settings

class LLMProvider:
    """Multi-provider LLM abstraction using LiteLLM."""

    def __init__(self, model: str | None = None, fallback_models: list[str] | None = None):
        self._model = model or settings.llm_model
        self._fallback_models = fallback_models or settings.llm_fallback_models

    async def complete(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate completion from prompt."""
        kwargs = {
            "model": self._model,  # e.g., "anthropic/claude-sonnet-4-20250514"
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }
        if self._fallback_models:
            kwargs["fallbacks"] = self._fallback_models

        response = await acompletion(**kwargs)
        return response.choices[0].message.content or ""

    async def complete_with_messages(self, messages: list[dict], max_tokens: int = 2000) -> str:
        """Generate completion from message list."""
        response = await acompletion(
            model=self._model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream_with_messages(self, messages: list[dict], max_tokens: int = 2000):
        """Stream completion tokens."""
        response = await acompletion(
            model=self._model, messages=messages, max_tokens=max_tokens, stream=True
        )
        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


# src/services/llm.py
class LLMService:
    """LLM service for vie-explainer using LiteLLM."""

    def __init__(self, provider: LLMProvider):
        self._provider = provider

    async def generate_expansion(self, template_name: str, context: dict) -> str:
        """Generate expansion from template."""
        template = load_prompt(template_name)
        prompt = template.format(**context)
        return await self._provider.complete(prompt, max_tokens=2000)

    async def chat_completion(self, system_prompt: str, messages: list[dict]) -> str:
        """Complete chat with context."""
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        return await self._provider.complete_with_messages(full_messages, max_tokens=2000)

    async def chat_completion_stream(self, system_prompt: str, messages: list[dict]):
        """Stream chat completion tokens."""
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        async for token in self._provider.stream_with_messages(full_messages, max_tokens=2000):
            yield token
```

**Model mapping (config.py):**
```python
MODEL_MAP = {
    "anthropic": {"default": "anthropic/claude-sonnet-4-20250514", "fast": "anthropic/claude-3-5-haiku-20241022"},
    "openai": {"default": "openai/gpt-4o", "fast": "openai/gpt-4o-mini"},
    "gemini": {"default": "gemini/gemini-3-flash-preview", "fast": "gemini/gemini-2.5-flash-lite"},
}
```

---

## Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

CMD ["python", "-m", "src.server"]
```

---

## Requirements

```text
fastapi>=0.109.0
uvicorn>=0.27.0
mcp>=1.0.0
litellm>=1.80.0
pymongo>=4.6.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0
```

---

## Commands

```bash
# Run MCP server
python -m src.server

# Development with MCP inspector
mcp dev src/server.py

# Tests
pytest
```
