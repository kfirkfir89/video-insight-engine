# Implementation Track 4: vie-explainer (Python MCP Server)

> **Parallel Track** - Can run simultaneously with other tracks.
> **Prerequisite:** [IMPL-00-SHARED.md](./IMPL-00-SHARED.md) complete.

---

## Overview

| What | Details |
|------|---------|
| **Service** | vie-explainer |
| **Tech** | Python 3.11 + MCP SDK |
| **Port** | 8001 |
| **Role** | MCP Server with explain_auto + explain_chat tools |

---

## Phase 1: Project Setup

### 1.1 Create Project Structure

```bash
mkdir -p services/explainer/src/{tools,services,prompts}
cd services/explainer
```

### 1.2 Create Requirements

- [ ] Create `services/explainer/requirements.txt`

```txt
# MCP
mcp>=1.0.0

# LLM
anthropic>=0.18.0

# Database
pymongo>=4.6.0

# Validation
pydantic>=2.5.0
pydantic-settings>=2.1.0

# Utils
python-dotenv>=1.0.0
```

### 1.3 Create pyproject.toml

- [ ] Create `services/explainer/pyproject.toml`

```toml
[project]
name = "vie-explainer"
version = "0.1.0"
requires-python = ">=3.11"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I"]
```

---

## Phase 2: Configuration

### 2.1 Settings

- [ ] Create `services/explainer/src/config.py`

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"
    
    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    
    class Config:
        env_file = ".env"


settings = Settings()
```

---

## Phase 3: Services

### 3.1 MongoDB Service

- [ ] Create `services/explainer/src/services/mongodb.py`

```python
from datetime import datetime
from typing import Any, Optional
from bson import ObjectId
from pymongo import MongoClient

from src.config import settings

client = MongoClient(settings.MONGODB_URI)
db = client.get_default_database()


# ═══════════════════════════════════════════════════
# Video Summary Cache
# ═══════════════════════════════════════════════════

def get_video_summary(video_summary_id: str) -> Optional[dict]:
    """Get video summary from cache."""
    return db.videoSummaryCache.find_one({"_id": ObjectId(video_summary_id)})


# ═══════════════════════════════════════════════════
# System Expansion Cache
# ═══════════════════════════════════════════════════

def get_expansion(
    video_summary_id: str,
    target_type: str,
    target_id: str
) -> Optional[dict]:
    """Get cached expansion."""
    return db.systemExpansionCache.find_one({
        "videoSummaryId": ObjectId(video_summary_id),
        "targetType": target_type,
        "targetId": target_id,
        "status": "completed",
    })


def save_expansion(
    video_summary_id: str,
    target_type: str,
    target_id: str,
    context: dict,
    content: str,
    model: str,
) -> str:
    """Save expansion to cache."""
    result = db.systemExpansionCache.insert_one({
        "videoSummaryId": ObjectId(video_summary_id),
        "targetType": target_type,
        "targetId": target_id,
        "context": context,
        "content": content,
        "status": "completed",
        "version": 1,
        "model": model,
        "generatedAt": datetime.utcnow(),
        "createdAt": datetime.utcnow(),
    })
    return str(result.inserted_id)


# ═══════════════════════════════════════════════════
# Memorized Items
# ═══════════════════════════════════════════════════

def get_memorized_item(item_id: str, user_id: str) -> Optional[dict]:
    """Get memorized item for user."""
    return db.memorizedItems.find_one({
        "_id": ObjectId(item_id),
        "userId": ObjectId(user_id),
    })


# ═══════════════════════════════════════════════════
# User Chats
# ═══════════════════════════════════════════════════

def get_chat(chat_id: str, user_id: str) -> Optional[dict]:
    """Get chat by ID."""
    return db.userChats.find_one({
        "_id": ObjectId(chat_id),
        "userId": ObjectId(user_id),
    })


def create_chat(user_id: str, memorized_item_id: str) -> str:
    """Create new chat."""
    result = db.userChats.insert_one({
        "userId": ObjectId(user_id),
        "memorizedItemId": ObjectId(memorized_item_id),
        "messages": [],
        "title": None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    })
    return str(result.inserted_id)


def add_messages(chat_id: str, messages: list[dict]) -> None:
    """Add messages to chat."""
    db.userChats.update_one(
        {"_id": ObjectId(chat_id)},
        {
            "$push": {"messages": {"$each": messages}},
            "$set": {"updatedAt": datetime.utcnow()},
        }
    )
```

---

### 3.2 LLM Service

- [ ] Create `services/explainer/src/services/llm.py`

```python
from pathlib import Path
import anthropic

from src.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


def generate_expansion(template_name: str, context: dict) -> str:
    """Generate expansion using template."""
    template = load_prompt(template_name)
    prompt = template.format(**context)
    
    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text


def chat_completion(system_prompt: str, messages: list[dict]) -> str:
    """Complete chat with context."""
    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        system=system_prompt,
        messages=messages,
    )
    
    return response.content[0].text
```

---

## Phase 4: Prompts

### 4.1 Explain Section Prompt

- [ ] Create `services/explainer/src/prompts/explain_section.txt`

```
You are creating detailed documentation for a video section.

VIDEO: {video_title}
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
- Clear headings (##, ###)
- Code blocks with syntax highlighting
- Bullet points for lists
- Bold for key terms

Be thorough but focused. Aim for 500-1000 words.
```

---

### 4.2 Explain Concept Prompt

- [ ] Create `services/explainer/src/prompts/explain_concept.txt`

```
You are creating detailed documentation for a concept from a video.

VIDEO: {video_title}
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

Format as clean Markdown with:
- Clear headings
- Code blocks with syntax highlighting
- Bullet points for lists
- Bold for key terms

Be thorough but focused. Aim for 400-800 words.
```

---

### 4.3 Chat System Prompt

- [ ] Create `services/explainer/src/prompts/chat_system.txt`

```
You are a helpful tutor discussing content the user has saved.

SAVED CONTENT:
Title: {title}
Source Video: {video_title}
YouTube: {youtube_url}

---

CONTENT:
{content}

---

USER'S NOTES:
{notes}

---

Help the user understand this content deeply:
- Answer questions clearly and thoroughly
- Provide practical examples when helpful
- Add code snippets when relevant
- Make connections to related concepts
- Be conversational and supportive
- If asked about something not in the content, say so and help anyway

Keep responses focused and helpful. Use Markdown for formatting.
```

---

## Phase 5: MCP Tools

### 5.1 Explain Auto Tool

- [ ] Create `services/explainer/src/tools/explain_auto.py`

```python
from src.services import mongodb, llm
from src.config import settings


async def explain_auto(
    video_summary_id: str,
    target_type: str,
    target_id: str,
) -> str:
    """
    Generate detailed documentation for a video section or concept.
    Results are cached and reused across all users.
    """
    
    # 1. Check cache
    cached = mongodb.get_expansion(video_summary_id, target_type, target_id)
    if cached:
        return cached["content"]
    
    # 2. Load video summary
    video_summary = mongodb.get_video_summary(video_summary_id)
    if not video_summary:
        raise ValueError("Video summary not found")
    
    summary = video_summary.get("summary", {})
    
    # 3. Find target and build context
    if target_type == "section":
        sections = summary.get("sections", [])
        target = next((s for s in sections if s["id"] == target_id), None)
        
        if not target:
            raise ValueError("Section not found")
        
        context = {
            "video_title": video_summary.get("title", "Unknown"),
            "youtube_id": video_summary.get("youtubeId"),
            "timestamp": target.get("timestamp", "00:00"),
            "title": target.get("title", ""),
            "summary": target.get("summary", ""),
            "bullets": "\n".join([f"- {b}" for b in target.get("bullets", [])]),
        }
        template = "explain_section"
        
    elif target_type == "concept":
        concepts = summary.get("concepts", [])
        target = next((c for c in concepts if c["id"] == target_id), None)
        
        if not target:
            raise ValueError("Concept not found")
        
        context = {
            "video_title": video_summary.get("title", "Unknown"),
            "youtube_id": video_summary.get("youtubeId"),
            "name": target.get("name", ""),
            "definition": target.get("definition", "No definition provided"),
        }
        template = "explain_concept"
        
    else:
        raise ValueError(f"Invalid target type: {target_type}")
    
    # 4. Generate with LLM
    content = llm.generate_expansion(template, context)
    
    # 5. Save to cache
    mongodb.save_expansion(
        video_summary_id=video_summary_id,
        target_type=target_type,
        target_id=target_id,
        context=context,
        content=content,
        model=settings.ANTHROPIC_MODEL,
    )
    
    return content
```

---

### 5.2 Explain Chat Tool

- [ ] Create `services/explainer/src/tools/explain_chat.py`

```python
import json
from datetime import datetime
from src.services import mongodb, llm


def format_content(source: dict) -> str:
    """Format memorized item content for prompt."""
    content_parts = []
    content = source.get("content", {})
    
    # Sections
    if "sections" in content:
        for section in content["sections"]:
            content_parts.append(f"## {section.get('title', 'Section')} ({section.get('timestamp', '')})")
            content_parts.append(section.get("summary", ""))
            if section.get("bullets"):
                content_parts.append("Key points:")
                for bullet in section["bullets"]:
                    content_parts.append(f"- {bullet}")
            content_parts.append("")
    
    # Concept
    if "concept" in content:
        concept = content["concept"]
        content_parts.append(f"## Concept: {concept.get('name', '')}")
        content_parts.append(concept.get("definition", ""))
    
    # Expansion
    if "expansion" in content:
        content_parts.append("## Detailed Explanation")
        content_parts.append(content["expansion"])
    
    return "\n".join(content_parts)


def build_system_prompt(item: dict) -> str:
    """Build system prompt from memorized item."""
    source = item.get("source", {})
    
    return lm.load_prompt("chat_system").format(
        title=item.get("title", "Saved Content"),
        video_title=source.get("videoTitle", "Unknown Video"),
        youtube_url=source.get("youtubeUrl", ""),
        content=format_content(source),
        notes=item.get("notes", "None"),
    )


async def explain_chat(
    memorized_item_id: str,
    user_id: str,
    message: str,
    chat_id: str | None = None,
) -> dict:
    """
    Interactive conversation about a memorized item.
    Personalized per user, not cached.
    """
    
    # 1. Load memorized item
    item = mongodb.get_memorized_item(memorized_item_id, user_id)
    if not item:
        raise ValueError("Memorized item not found or unauthorized")
    
    # 2. Load or create chat
    if chat_id:
        chat = mongodb.get_chat(chat_id, user_id)
        if not chat:
            raise ValueError("Chat not found")
    else:
        chat_id = mongodb.create_chat(user_id, memorized_item_id)
        chat = {"messages": []}
    
    # 3. Build messages for LLM
    system_prompt = build_system_prompt(item)
    
    messages = []
    for msg in chat.get("messages", []):
        messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })
    
    messages.append({
        "role": "user",
        "content": message,
    })
    
    # 4. Call LLM
    response = llm.chat_completion(system_prompt, messages)
    
    # 5. Save messages to chat
    now = datetime.utcnow()
    mongodb.add_messages(chat_id, [
        {"role": "user", "content": message, "createdAt": now},
        {"role": "assistant", "content": response, "createdAt": now},
    ])
    
    return {
        "response": response,
        "chatId": chat_id,
    }
```

---

## Phase 6: MCP Server

### 6.1 Server Entry Point

- [ ] Create `services/explainer/src/server.py`

```python
import asyncio
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server

from src.tools.explain_auto import explain_auto
from src.tools.explain_chat import explain_chat

# Create MCP server
server = Server("vie-explainer")


@server.tool()
async def explain_auto_tool(
    videoSummaryId: str,
    targetType: str,
    targetId: str,
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
    try:
        content = await explain_auto(videoSummaryId, targetType, targetId)
        return content
    except ValueError as e:
        return json.dumps({"error": str(e)})
    except Exception as e:
        return json.dumps({"error": f"Internal error: {str(e)}"})


@server.tool()
async def explain_chat_tool(
    memorizedItemId: str,
    userId: str,
    message: str,
    chatId: str | None = None,
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
    try:
        result = await explain_chat(memorizedItemId, userId, message, chatId)
        return json.dumps(result)
    except ValueError as e:
        return json.dumps({"error": str(e)})
    except Exception as e:
        return json.dumps({"error": f"Internal error: {str(e)}"})


async def main():
    """Run the MCP server."""
    print("🚀 Starting vie-explainer MCP server...")
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)


if __name__ == "__main__":
    asyncio.run(main())
```

---

### 6.2 Health Endpoint (Optional HTTP)

- [ ] Create `services/explainer/src/main.py`

```python
from fastapi import FastAPI
from src.config import settings

app = FastAPI(title="vie-explainer")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "vie-explainer",
        "type": "mcp-server",
        "model": settings.ANTHROPIC_MODEL,
    }


@app.get("/")
async def root():
    return {
        "service": "vie-explainer",
        "version": "0.1.0",
        "tools": ["explain_auto", "explain_chat"],
    }
```

---

## Phase 7: Dockerfile

- [ ] Create `services/explainer/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install uvicorn for health endpoint
RUN pip install uvicorn fastapi

# Copy source
COPY src/ ./src/

# Health endpoint
EXPOSE 8001

# Run MCP server by default
CMD ["python", "-m", "src.server"]
```

---

### 7.1 Docker Compose Entry

Update `docker-compose.yml` to add:

```yaml
vie-explainer:
  build: ./services/explainer
  container_name: vie-explainer
  restart: unless-stopped
  ports:
    - "8001:8001"
  environment:
    PYTHONUNBUFFERED: 1
    MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}
  networks:
    - vie-network
  depends_on:
    vie-mongodb:
      condition: service_healthy
  # Run health endpoint alongside MCP server
  command: >
    sh -c "uvicorn src.main:app --host 0.0.0.0 --port 8001 &
           python -m src.server"
```

---

## Phase 8: API Integration

### 8.1 MCP Client in vie-api

The vie-api connects to vie-explainer as an MCP client. Here's the integration pattern:

```typescript
// api/src/plugins/mcp.ts

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

export async function mcpPlugin(fastify: FastifyInstance) {
  // Connect to explainer via stdio
  const transport = new StdioClientTransport({
    command: 'python',
    args: ['-m', 'src.server'],
    cwd: process.env.EXPLAINER_PATH || '../services/explainer',
  });

  const client = new Client({
    name: 'vie-api',
    version: '1.0.0',
  });

  await client.connect(transport);

  // Decorate fastify with MCP methods
  fastify.decorate('mcp', {
    async explainAuto(videoSummaryId: string, targetType: string, targetId: string) {
      const result = await client.callTool('explain_auto_tool', {
        videoSummaryId,
        targetType,
        targetId,
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      return result.content[0].text;
    },

    async explainChat(memorizedItemId: string, userId: string, message: string, chatId?: string) {
      const result = await client.callTool('explain_chat_tool', {
        memorizedItemId,
        userId,
        message,
        ...(chatId && { chatId }),
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      return JSON.parse(result.content[0].text);
    },
  });

  fastify.addHook('onClose', async () => {
    await client.close();
  });
}
```

---

## Verification Checklist

```bash
# 1. Install dependencies
cd services/explainer
pip install -r requirements.txt

# 2. Test MCP server starts
python -m src.server
# Expected: "🚀 Starting vie-explainer MCP server..."

# 3. Test with MCP inspector (if installed)
mcp dev src/server.py

# 4. Test explain_auto directly (with test data in DB)
python -c "
import asyncio
from src.tools.explain_auto import explain_auto

# Replace with real video_summary_id from your DB
result = asyncio.run(explain_auto(
    'YOUR_VIDEO_SUMMARY_ID',
    'section',
    'YOUR_SECTION_ID'
))
print(result[:500])
"

# 5. Health check (with HTTP server running)
curl http://localhost:8001/health
# Expected: {"status":"ok","service":"vie-explainer",...}
```

---

## Integration Points

| Service | Integration | Status |
|---------|-------------|--------|
| vie-mongodb | Cache expansions, chats | ✅ Phase 3 |
| vie-api | MCP client connection | 🔄 Needs API |

---

## Next Steps

After this track:

1. Uncomment `vie-explainer` in `docker-compose.yml`
2. Run `docker-compose up -d --build vie-explainer`
3. Update vie-api to connect as MCP client
4. Test explain endpoints end-to-end
