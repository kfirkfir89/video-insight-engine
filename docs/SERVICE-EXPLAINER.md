# Service: vie-explainer

Python MCP server for AI-powered video explanation tools.

**Type:** MCP Server (Streamable HTTP transport)
**Protocol:** MCP spec 2025-03-26

---

## Tech Stack

| Technology   | Purpose        |
| ------------ | -------------- |
| Python 3.11+ | Runtime        |
| Starlette    | HTTP framework (lifespan, health endpoint) |
| FastMCP      | MCP server framework (`mcp>=1.25,<2`) |
| Motor        | Async MongoDB driver |
| LiteLLM      | Multi-provider LLM abstraction (Anthropic, OpenAI, Gemini) |
| Pydantic     | Validation & Settings |
| structlog    | Structured logging |

---

## MCP Tools

| Tool           | Purpose                              | Cached? |
| -------------- | ------------------------------------ | ------- |
| `explain_auto` | Generate documentation for section/concept | Yes (systemExpansionCache) |
| `video_chat`   | Chat about a video being viewed      | No (ephemeral) |

---

## Project Structure

```
services/explainer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── server.py                 # Starlette + FastMCP entry point
    ├── config.py                 # Settings + model mapping
    ├── schemas.py                # Pydantic domain models
    ├── dependencies.py           # Module-level DI (non-FastAPI)
    ├── exceptions.py             # Custom exceptions
    ├── logging_config.py         # structlog configuration
    ├── middleware.py              # Request ID middleware
    │
    ├── tools/
    │   ├── explain_auto.py       # Cached expansion generation
    │   └── video_chat.py         # Video-scoped conversation
    │
    ├── services/
    │   ├── llm.py                # LLM service
    │   └── llm_provider.py       # LiteLLM abstraction
    │
    ├── repositories/
    │   ├── __init__.py
    │   ├── base.py               # Repository protocols
    │   └── mongodb_repository.py # Motor async implementation
    │
    ├── prompts/
    │   ├── explain_section.txt
    │   ├── explain_concept.txt
    │   └── video_chat_system.txt
    │
    └── utils/
        └── content_extractor.py  # Extract summary/bullets from content blocks
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

LOG_LEVEL=INFO
LOG_FORMAT=console              # console or json
```

---

## MCP Server Implementation

### Entry Point

The server uses Starlette + FastMCP with Streamable HTTP transport. The MCP endpoint is at `/mcp`, and a health check is at `/health`.

```python
# src/server.py

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette

mcp = FastMCP(
    "vie-explainer",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "127.0.0.1:*", "localhost:*", "[::1]:*",
            "vie-explainer:*",  # Docker internal hostname
        ],
    ),
)

@mcp.tool()
async def explain_auto(
    video_summary_id: str,
    target_type: str,
    target_id: str,
) -> str:
    """Generate detailed documentation for a video section or concept."""
    ...

@mcp.tool()
async def video_chat(
    video_summary_id: str,
    user_message: str,
    chat_history: list[dict] | None = None,
) -> str:
    """Chat about a specific video. Answer questions grounded in video content."""
    ...

# Starlette app with combined lifespan (MongoDB + MCP session manager)
mcp_app = mcp.streamable_http_app()
app = Starlette(routes=[Route("/health", health_endpoint)], lifespan=lifespan)
app.mount("/", mcp_app)
```

### Key Architecture Decisions

- **Starlette over FastAPI**: FastAPI has a confirmed lifespan bug when mounting MCP sub-apps. Starlette handles nested lifespans cleanly.
- **Streamable HTTP over stdio**: Service-to-service in Docker requires HTTP transport, not stdio.
- **TransportSecuritySettings**: Docker internal hostnames must be added to `allowed_hosts` for DNS rebinding protection.
- **Combined lifespan**: MongoDB init + `mcp._session_manager.run()` are composed in a single Starlette lifespan.

---

## Tool: explain_auto

Generate cached documentation for a video section or concept. Results are stored in `systemExpansionCache` and reused across all users.

### Input Schema

```json
{
  "video_summary_id": "MongoDB ObjectId string",
  "target_type": "section | concept",
  "target_id": "UUID of section or concept"
}
```

### Flow

```
Input received
      │
      ▼
Check systemExpansionCache
by (videoSummaryId + targetType + targetId)
      │
   ┌──┴──┐
   │     │
  HIT   MISS
   │     │
   ▼     ▼
Return  Load video summary from videoSummaryCache
cached  Find target in summary.chapters (section) or summary.concepts
   │         │
   │         ▼
   │    Build prompt from template (explain_section / explain_concept)
   │         │
   │         ▼
   │    Call LLM via LiteLLM
   │         │
   │         ▼
   │    Save to systemExpansionCache
   │         │
   └────┬────┘
        │
        ▼
  Return markdown content
```

---

## Tool: video_chat

Chat about a specific video. Answers are grounded in the video's content. This tool is ephemeral — no server-side persistence. Chat history is passed by the caller (vie-api, from React state).

### Input Schema

```json
{
  "video_summary_id": "MongoDB ObjectId string",
  "user_message": "User's question about the video",
  "chat_history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
}
```

### Flow

```
Input received
      │
      ▼
Load video summary from videoSummaryCache
      │
      ▼
Build context: title, TLDR, chapter titles + content summaries, concepts
      │
      ▼
Build system prompt from video_chat_system.txt template
      │
      ▼
Construct messages: [system, ...chat_history, user_message]
      │
      ▼
Call LLM via LiteLLM
      │
      ▼
Return response text (no persistence)
```

---

## LLM Service (LiteLLM Multi-Provider)

```python
# src/services/llm_provider.py
from litellm import acompletion

class LLMProvider:
    """Multi-provider LLM abstraction using LiteLLM."""

    async def complete(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate completion from prompt."""
        ...

    async def complete_with_messages(self, messages: list[dict], max_tokens: int = 2000) -> str:
        """Generate completion from message list."""
        ...
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
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

## Requirements

```text
mcp>=1.25,<2
starlette>=0.41.0
uvicorn>=0.27.0
litellm>=1.80.0
pymongo>=4.6.0
motor>=3.3.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0
structlog>=24.1.0
```

---

## Commands

```bash
# Run server (production)
uvicorn src.server:app --host 0.0.0.0 --port 8001

# Development with hot reload
uvicorn src.server:app --host 0.0.0.0 --port 8001 --reload --reload-dir /app/src

# Tests
pytest
```
