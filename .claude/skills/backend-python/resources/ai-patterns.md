# AI Patterns (Python)

Advanced patterns for building AI apps - RAG, MCP, agents, guardrails, and observability.

---

## MCP (Model Context Protocol)

### Server Setup

```python
# mcp/server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, Resource, TextContent

server = Server("my-mcp-server")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="search_documents",
            description="Search internal documents",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "number", "description": "Max results"},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="create_ticket",
            description="Create a support ticket",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": ["title", "description"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls."""
    match name:
        case "search_documents":
            results = await document_service.search(
                arguments["query"],
                arguments.get("limit", 5)
            )
            return [TextContent(type="text", text=json.dumps(results))]

        case "create_ticket":
            ticket = await ticket_service.create(
                title=arguments["title"],
                description=arguments["description"],
                priority=arguments.get("priority", "medium"),
            )
            return [TextContent(type="text", text=f"Created ticket: {ticket.id}")]

        case _:
            raise ValueError(f"Unknown tool: {name}")


@server.list_resources()
async def list_resources() -> list[Resource]:
    """List available resources."""
    return [
        Resource(
            uri="docs://handbook",
            name="Employee Handbook",
            description="Company policies and procedures",
            mimeType="text/markdown",
        ),
        Resource(
            uri="docs://api-reference",
            name="API Reference",
            description="API documentation",
            mimeType="text/markdown",
        ),
    ]


@server.read_resource()
async def read_resource(uri: str) -> str:
    """Read resource content."""
    content = await resource_service.get_by_uri(uri)
    return content


async def main():
    """Run MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### MCP Client Usage

```python
# Using MCP tools in your app
from mcp import ClientSession
from mcp.client.stdio import stdio_client


async def use_mcp_tools():
    async with stdio_client(["python", "mcp/server.py"]) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List tools
            tools = await session.list_tools()

            # Call a tool
            result = await session.call_tool(
                "search_documents",
                arguments={"query": "vacation policy", "limit": 5}
            )
```

---

## RAG Pipeline

### DO ✅

```python
# services/rag_service.py
from pydantic import BaseModel
from litellm import acompletion, completion_cost
from lib.vector import vector_store
from lib.embeddings import embed_text


class RAGOptions(BaseModel):
    top_k: int = 5
    min_score: float = 0.7
    include_metadata: bool = True
    model: str = "anthropic/claude-sonnet-4-20250514"


class Source(BaseModel):
    content: str
    score: float
    metadata: dict | None = None


class RAGResult(BaseModel):
    answer: str
    sources: list[Source]
    usage: dict[str, int]
    cost_usd: float


async def rag_query(query: str, options: RAGOptions | None = None) -> RAGResult:
    """Execute RAG query using LiteLLM."""
    opts = options or RAGOptions()

    # 1. Embed the query
    query_embedding = await embed_text(query)

    # 2. Retrieve relevant documents
    results = await vector_store.search(
        vector=query_embedding,
        top_k=opts.top_k,
        min_score=opts.min_score,
    )

    # 3. Build context from results
    context = "\n\n".join(
        f"[{i + 1}] {r.content}" for i, r in enumerate(results)
    )

    # 4. Generate answer with context using LiteLLM
    response = await acompletion(
        model=opts.model,
        messages=[
            {
                "role": "system",
                "content": f"""You are a helpful assistant. Answer based on the provided context.
If the context doesn't contain relevant information, say so.
Cite sources using [1], [2], etc.

Context:
{context}""",
            },
            {"role": "user", "content": query},
        ],
        max_tokens=1000,
    )

    # Track cost with LiteLLM's built-in function
    cost = completion_cost(completion_response=response)

    return RAGResult(
        answer=response.choices[0].message.content or "",
        sources=[
            Source(
                content=r.content[:200] + "...",
                score=r.score,
                metadata=r.metadata if opts.include_metadata else None,
            )
            for r in results
        ],
        usage={
            "input_tokens": response.usage.prompt_tokens if response.usage else 0,
            "output_tokens": response.usage.completion_tokens if response.usage else 0,
        },
        cost_usd=cost,
    )
```

### Document Ingestion

```python
# services/ingest_service.py
from pydantic import BaseModel
from lib.embeddings import embed_texts
from lib.vector import vector_store


class Document(BaseModel):
    id: str
    content: str
    metadata: dict


async def ingest_documents(documents: list[Document]) -> None:
    """Ingest documents into vector store."""
    # 1. Chunk documents
    chunks = []
    for doc in documents:
        for i, chunk in enumerate(chunk_text(doc.content)):
            chunks.append({
                "id": f"{doc.id}-{i}",
                "content": chunk,
                "metadata": {**doc.metadata, "chunk_index": i, "parent_id": doc.id},
            })

    # 2. Generate embeddings in batches
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        embeddings = await embed_texts([c["content"] for c in batch])

        # 3. Store in vector DB
        await vector_store.upsert([
            {
                "id": chunk["id"],
                "vector": embedding,
                "metadata": {"content": chunk["content"], **chunk["metadata"]},
            }
            for chunk, embedding in zip(batch, embeddings)
        ])


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50
) -> list[str]:
    """Split text into overlapping chunks."""
    chunks: list[str] = []

    # Split by paragraphs
    paragraphs = text.split("\n\n")
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            # Keep overlap
            words = current_chunk.split()
            overlap_words = words[-overlap // 5 :] if len(words) > overlap // 5 else []
            current_chunk = " ".join(overlap_words) + "\n\n" + para
        else:
            current_chunk += ("\n\n" if current_chunk else "") + para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks
```

---

## Embeddings & Vector Store

### DO ✅

```python
# lib/embeddings.py
from litellm import aembedding


async def embed_text(text: str, model: str = "openai/text-embedding-3-small") -> list[float]:
    """Generate embedding for text using LiteLLM."""
    response = await aembedding(
        model=model,
        input=text,
    )

    return response.data[0]["embedding"]


async def embed_texts(texts: list[str], model: str = "openai/text-embedding-3-small") -> list[list[float]]:
    """Generate embeddings for multiple texts using LiteLLM."""
    response = await aembedding(
        model=model,
        input=texts,
    )

    return [d["embedding"] for d in response.data]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Calculate cosine similarity between vectors."""
    import math

    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))

    return dot_product / (norm_a * norm_b)
```

### Pinecone Integration

```python
# lib/vector/pinecone.py
from pinecone import Pinecone
from app.core.config import settings

pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index = pc.Index(settings.PINECONE_INDEX)


class VectorStore:
    async def upsert(self, vectors: list[dict]) -> None:
        """Upsert vectors into index."""
        index.upsert(vectors=[
            (v["id"], v["vector"], v["metadata"])
            for v in vectors
        ])

    async def search(
        self,
        vector: list[float],
        top_k: int = 5,
        min_score: float = 0.0,
    ) -> list[dict]:
        """Search for similar vectors."""
        results = index.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True,
        )

        return [
            {
                "id": m.id,
                "score": m.score,
                "content": m.metadata.get("content", ""),
                "metadata": m.metadata,
            }
            for m in results.matches
            if m.score >= min_score
        ]

    async def delete(self, ids: list[str]) -> None:
        """Delete vectors by ID."""
        index.delete(ids=ids)


vector_store = VectorStore()
```

### pgvector Integration

```python
# lib/vector/pgvector.py
import asyncpg
from app.core.config import settings


class PgVectorStore:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(settings.DATABASE_URL)

    async def upsert(self, vectors: list[dict]) -> None:
        """Upsert vectors."""
        async with self.pool.acquire() as conn:
            for v in vectors:
                await conn.execute(
                    """
                    INSERT INTO embeddings (id, embedding, metadata, content)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata,
                        content = EXCLUDED.content
                    """,
                    v["id"],
                    str(v["vector"]),
                    v["metadata"],
                    v["metadata"].get("content"),
                )

    async def search(
        self,
        vector: list[float],
        top_k: int = 5,
        min_score: float = 0.0,
    ) -> list[dict]:
        """Search using cosine similarity."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, metadata,
                       1 - (embedding <=> $1::vector) as score
                FROM embeddings
                WHERE 1 - (embedding <=> $1::vector) >= $3
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                str(vector),
                top_k,
                min_score,
            )

            return [dict(row) for row in rows]


vector_store = PgVectorStore()
```

---

## Agents with PydanticAI

PydanticAI is the modern Python agent framework from the Pydantic team. It provides type-safe tools, dependency injection, structured output, and streaming - all with Pydantic validation.

### DO ✅ - Basic Agent

```python
# services/agent_service.py
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass


# Dependencies injected into agent tools
@dataclass
class AgentDependencies:
    knowledge_service: KnowledgeService
    user_service: UserService
    user_id: str


# Structured output with validation
class AgentOutput(BaseModel):
    answer: str
    confidence: float
    sources: list[str]


# Create typed agent
agent = Agent(
    "anthropic:claude-sonnet-4-20250514",  # PydanticAI model format
    deps_type=AgentDependencies,
    output_type=AgentOutput,
    system_prompt="You are a helpful assistant. Always cite your sources.",
)


# Type-safe tool with dependency injection
@agent.tool
async def search_knowledge(
    ctx: RunContext[AgentDependencies],
    query: str,
) -> list[dict]:
    """Search the internal knowledge base."""
    return await ctx.deps.knowledge_service.search(query)


@agent.tool
async def lookup_user(
    ctx: RunContext[AgentDependencies],
    user_id: str,
) -> dict:
    """Look up user information by ID."""
    user = await ctx.deps.user_service.find_by_id(user_id)
    return user.model_dump() if user else {}


@agent.tool
def calculate(expression: str) -> float:
    """Safely evaluate a mathematical expression."""
    # Use ast.literal_eval or a safe math parser in production
    import ast
    return float(ast.literal_eval(expression))


async def run_agent(
    query: str,
    deps: AgentDependencies,
) -> AgentOutput:
    """Run agent and get structured output."""
    result = await agent.run(query, deps=deps)
    return result.output
```

### DO ✅ - Agent with Streaming

```python
from pydantic_ai import Agent
from collections.abc import AsyncGenerator


agent = Agent(
    "anthropic:claude-sonnet-4-20250514",
    system_prompt="You are a helpful assistant.",
)


async def stream_agent_response(query: str) -> AsyncGenerator[str, None]:
    """Stream agent response with validation."""
    async with agent.run_stream(query) as result:
        async for chunk in result.stream_text():
            yield chunk

    # Final validated output available after stream
    final_output = result.output
```

### DO ✅ - Dynamic System Prompts

```python
from pydantic_ai import Agent, RunContext


@dataclass
class ChatDependencies:
    user_name: str
    user_preferences: dict


agent = Agent(
    "anthropic:claude-sonnet-4-20250514",
    deps_type=ChatDependencies,
)


@agent.system_prompt
async def dynamic_prompt(ctx: RunContext[ChatDependencies]) -> str:
    """Generate system prompt based on user context."""
    return f"""You are a helpful assistant for {ctx.deps.user_name}.
Their preferences: {ctx.deps.user_preferences}
Adapt your responses accordingly."""
```

### DO ✅ - Multiple Tool Agents

```python
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel


class ResearchOutput(BaseModel):
    summary: str
    key_findings: list[str]
    recommendations: list[str]


@dataclass
class ResearchDependencies:
    db: Database
    search_client: SearchClient


research_agent = Agent(
    "anthropic:claude-sonnet-4-20250514",
    deps_type=ResearchDependencies,
    output_type=ResearchOutput,
    system_prompt="You are a research analyst. Be thorough and cite sources.",
)


@research_agent.tool
async def search_documents(
    ctx: RunContext[ResearchDependencies],
    query: str,
    limit: int = 10,
) -> list[dict]:
    """Search internal documents."""
    return await ctx.deps.search_client.search(query, limit=limit)


@research_agent.tool
async def get_statistics(
    ctx: RunContext[ResearchDependencies],
    metric: str,
    time_range: str = "30d",
) -> dict:
    """Get statistics from the database."""
    return await ctx.deps.db.get_metrics(metric, time_range)


@research_agent.tool
async def fetch_external_data(
    ctx: RunContext[ResearchDependencies],
    url: str,
) -> str:
    """Fetch data from external API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.text
```

### DO ✅ - Usage Tracking

```python
from pydantic_ai import Agent


agent = Agent("anthropic:claude-sonnet-4-20250514")


async def run_with_tracking(query: str) -> tuple[str, dict]:
    """Run agent and track usage."""
    result = await agent.run(query)

    usage = {
        "input_tokens": result.usage.request_tokens,
        "output_tokens": result.usage.response_tokens,
        "total_tokens": result.usage.total_tokens,
    }

    return result.output, usage
```

### DON'T ❌ - Manual ReAct Parsing

```python
# OUTDATED: Manual text parsing is fragile and error-prone
AGENT_SYSTEM_PROMPT = """
THOUGHT: Your reasoning
ACTION: tool_name
ACTION_INPUT: {...}
"""

# Regex parsing of LLM output
thought = re.search(r"THOUGHT:\s*(.+?)(?=ACTION:|$)", content)
action = re.search(r"ACTION:\s*(.+?)(?=ACTION_INPUT:|$)", content)
# This breaks when LLM formats slightly differently!

# Instead, use PydanticAI's built-in tool handling
```

### Model Name Mapping

PydanticAI uses its own model format. For LiteLLM integration, use the adapter:

```python
from pydantic_ai import Agent
from pydantic_ai.models.litellm import LiteLLMModel

# Using PydanticAI's LiteLLM adapter
model = LiteLLMModel("anthropic/claude-sonnet-4-20250514")
agent = Agent(model)

# Or use PydanticAI's native format
agent = Agent("anthropic:claude-sonnet-4-20250514")  # Note: colon not slash
```

| PydanticAI Format | LiteLLM Format |
|-------------------|----------------|
| `anthropic:claude-sonnet-4-20250514` | `anthropic/claude-sonnet-4-20250514` |
| `openai:gpt-4o` | `openai/gpt-4o` |
| `gemini:gemini-1.5-pro` | `gemini/gemini-1.5-pro` |

---

## Context Management

### DO ✅

```python
# services/context_service.py
from pydantic import BaseModel
from litellm import acompletion
from lib.tokens import count_tokens


class ConversationContext(BaseModel):
    messages: list[Message] = []
    summary: str | None = None
    total_tokens: int = 0


MAX_CONTEXT_TOKENS = 8000
SUMMARIZE_THRESHOLD = 6000


class ContextManager:
    def __init__(self, model: str = "anthropic/claude-3-5-haiku-20241022"):
        self.context = ConversationContext()
        self.model = model  # Use fast model for summarization

    async def add_message(self, message: Message) -> None:
        """Add message and summarize if needed."""
        self.context.messages.append(message)
        self.context.total_tokens += count_tokens(message.content)

        if self.context.total_tokens > SUMMARIZE_THRESHOLD:
            await self._summarize_old_messages()

    async def _summarize_old_messages(self) -> None:
        """Summarize older messages to save tokens."""
        keep_count = 4
        to_summarize = self.context.messages[:-keep_count]
        to_keep = self.context.messages[-keep_count:]

        if len(to_summarize) < 2:
            return

        response = await acompletion(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "Summarize this conversation concisely, keeping key facts.",
                },
                {
                    "role": "user",
                    "content": "\n".join(f"{m.role}: {m.content}" for m in to_summarize),
                },
            ],
            max_tokens=500,
        )

        self.context.summary = response.choices[0].message.content
        self.context.messages = to_keep
        self.context.total_tokens = (
            count_tokens(self.context.summary or "") +
            sum(count_tokens(m.content) for m in to_keep)
        )

    def get_messages_for_api(self) -> list[dict]:
        """Get messages formatted for API call."""
        messages = []

        if self.context.summary:
            messages.append({
                "role": "system",
                "content": f"Previous conversation summary:\n{self.context.summary}",
            })

        messages.extend(m.model_dump() for m in self.context.messages)
        return messages
```

---

## Prompt Engineering

### DO ✅

```python
# lib/prompts/templates.py


def few_shot_prompt(
    task: str,
    examples: list[dict[str, str]],
    input: str
) -> str:
    """Create few-shot prompt."""
    example_text = "\n\n".join(
        f"Input: {e['input']}\nOutput: {e['output']}" for e in examples
    )

    return f"""{task}

Examples:
{example_text}

Now process this:
Input: {input}
Output:"""


def chain_of_thought_prompt(question: str) -> str:
    """Create chain-of-thought prompt."""
    return f"""{question}

Let's think through this step by step:
1."""


def extraction_prompt(text: str, schema: dict[str, str]) -> str:
    """Create extraction prompt."""
    fields = "\n".join(f"- {key}: {desc}" for key, desc in schema.items())

    return f"""Extract the following information from the text:

{fields}

Text:
{text}

Respond in JSON format."""


# System prompts for different personas
SYSTEM_PROMPTS = {
    "assistant": "You are a helpful AI assistant. Be concise and accurate.",

    "coder": """You are an expert programmer. Write clean, well-documented code.
Always explain your approach before writing code.
Use best practices and modern patterns.""",

    "analyst": """You are a data analyst. Focus on insights and patterns.
Support claims with data. Be precise with numbers.
Present findings in a clear, structured way.""",

    "writer": """You are a skilled writer. Focus on clarity and engagement.
Adapt tone to the audience. Be creative but accurate.""",
}
```

---

## Guardrails & Safety

### DO ✅

```python
# services/guardrails_service.py
from pydantic import BaseModel
from litellm import amoderation, acompletion
import re


class ValidationResult(BaseModel):
    safe: bool
    issues: list[str]


class OutputValidation(BaseModel):
    safe: bool
    sanitized: str
    issues: list[str]


async def validate_input(text: str) -> ValidationResult:
    """Validate user input for safety."""
    issues: list[str] = []

    # Check length
    if len(text) > 10000:
        issues.append("Input too long")

    # Check for prompt injection patterns
    injection_patterns = [
        r"ignore previous instructions",
        r"disregard all prior",
        r"forget everything",
        r"you are now",
        r"new persona",
    ]

    for pattern in injection_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            issues.append("Potential prompt injection detected")
            break

    # Use OpenAI moderation API via LiteLLM
    moderation = await amoderation(model="text-moderation-latest", input=text)

    if moderation.results[0].flagged:
        categories = moderation.results[0].categories
        for cat, flagged in vars(categories).items():
            if flagged:
                issues.append(f"Content flagged: {cat}")

    return ValidationResult(safe=len(issues) == 0, issues=issues)


async def validate_output(output: str) -> OutputValidation:
    """Validate and sanitize AI output."""
    issues: list[str] = []
    sanitized = output

    # Check for PII patterns
    pii_patterns = {
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
        "credit_card": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
        "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "phone": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
    }

    for pii_type, pattern in pii_patterns.items():
        if re.search(pattern, output):
            issues.append(f"PII detected: {pii_type}")
            sanitized = re.sub(pattern, f"[REDACTED {pii_type.upper()}]", sanitized)

    # Check for harmful content via LiteLLM
    moderation = await amoderation(model="text-moderation-latest", input=output)

    if moderation.results[0].flagged:
        issues.append("Output flagged by moderation")

    return OutputValidation(safe=len(issues) == 0, sanitized=sanitized, issues=issues)


async def safe_completion(
    prompt: str,
    model: str = "anthropic/claude-sonnet-4-20250514",
) -> tuple[str, bool]:
    """Complete with safety guardrails."""
    # Validate input
    input_check = await validate_input(prompt)
    if not input_check.safe:
        return "I cannot process this request.", True

    # Generate response using LiteLLM
    response = await acompletion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    result = response.choices[0].message.content or ""

    # Validate output
    output_check = await validate_output(result)

    return output_check.sanitized, not output_check.safe
```

---

## Conversation Memory

### DO ✅

```python
# services/memory_service.py
from datetime import datetime, UTC
from pydantic import BaseModel


class ConversationMemory(BaseModel):
    id: str
    user_id: str
    messages: list[Message]
    summary: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int


class MemoryService:
    async def save_conversation(
        self,
        user_id: str,
        conversation_id: str,
        messages: list[Message]
    ) -> None:
        """Save or update conversation."""
        existing = await db.conversations.find_one({"id": conversation_id})

        if existing:
            await db.conversations.update_one(
                {"id": conversation_id},
                {
                    "$set": {
                        "messages": [m.model_dump() for m in messages],
                        "updated_at": datetime.now(UTC),
                        "message_count": len(messages),
                    }
                },
            )
        else:
            await db.conversations.insert_one({
                "id": conversation_id,
                "user_id": user_id,
                "messages": [m.model_dump() for m in messages],
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
                "message_count": len(messages),
            })

    async def load_conversation(self, conversation_id: str) -> list[Message]:
        """Load conversation messages."""
        conv = await db.conversations.find_one({"id": conversation_id})
        if not conv:
            return []
        return [Message(**m) for m in conv["messages"]]

    async def search_conversations(
        self,
        user_id: str,
        query: str,
        limit: int = 10
    ) -> list[ConversationMemory]:
        """Search user's conversations."""
        query_embedding = await embed_text(query)

        # Use vector search if available
        results = await db.conversations.aggregate([
            {"$match": {"user_id": user_id}},
            {"$sort": {"updated_at": -1}},
            {"$limit": limit},
        ]).to_list(limit)

        return [ConversationMemory(**r) for r in results]


memory_service = MemoryService()
```

---

## Observability & Evaluation

### DO ✅

```python
# lib/observability.py
from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode
from litellm import acompletion, completion_cost
import structlog
from functools import wraps
from typing import Callable, TypeVar, ParamSpec
from pydantic import BaseModel
import json

tracer = trace.get_tracer("ai-service")
logger = structlog.get_logger()

P = ParamSpec("P")
T = TypeVar("T")


def traced(name: str):
    """Decorator to trace AI calls."""
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            with tracer.start_as_current_span(name, kind=SpanKind.CLIENT) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise
        return wrapper
    return decorator


def log_ai_request(
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
    success: bool,
    cost_usd: float,
    error: str | None = None,
) -> None:
    """Log AI request metrics."""
    logger.info(
        "ai_request",
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        success=success,
        error=error,
        cost_usd=cost_usd,  # Use LiteLLM's completion_cost()
    )


class EvalResult(BaseModel):
    score: float
    feedback: str


async def evaluate_response(
    query: str,
    response: str,
    expected_behavior: str,
    model: str = "anthropic/claude-sonnet-4-20250514",
) -> EvalResult:
    """Evaluate AI response quality using LiteLLM."""
    result = await acompletion(
        model=model,
        messages=[
            {
                "role": "system",
                "content": f"""Evaluate the AI response. Score 1-5 and explain.
Expected behavior: {expected_behavior}

Respond with JSON: {{"score": <1-5>, "feedback": "<explanation>"}}""",
            },
            {
                "role": "user",
                "content": f"Query: {query}\n\nResponse: {response}",
            },
        ],
        response_format={"type": "json_object"},
    )

    content = json.loads(result.choices[0].message.content or "{}")
    return EvalResult(
        score=content.get("score", 0),
        feedback=content.get("feedback", ""),
    )


# PydanticAI has built-in OpenTelemetry support
# See: https://ai.pydantic.dev/logfire/
```

---

## Quick Reference

| Pattern    | When to Use                            | Tool |
| ---------- | -------------------------------------- | ---- |
| MCP        | Connecting LLMs to external tools/data | mcp SDK |
| RAG        | Knowledge-base Q&A, document search    | LiteLLM + vector store |
| Agents     | Multi-step reasoning, complex tasks    | **PydanticAI** |
| Guardrails | Production safety, compliance          | LiteLLM + custom rules |
| Memory     | Long-running conversations             | LiteLLM + database |

| Need | Use | Why |
|------|-----|-----|
| Single LLM call | LiteLLM `acompletion()` | Unified API across providers |
| Streaming | LiteLLM `stream=True` | Built-in async generator |
| Fallbacks | LiteLLM `fallbacks=[]` | Built-in provider fallback |
| Cost tracking | LiteLLM `completion_cost()` | Automatic pricing |
| Agents with tools | PydanticAI `Agent` | Type-safe, dependency injection |
| Structured output | PydanticAI `output_type` | Pydantic validation |

| Component     | Tools                                |
| ------------- | ------------------------------------ |
| LLM API       | LiteLLM (unified interface)          |
| Agent Framework | PydanticAI (type-safe agents)      |
| Vector DB     | Pinecone, Qdrant, pgvector, Weaviate |
| Observability | LangSmith, Helicone, OpenTelemetry, Logfire |
| Evaluation    | Custom metrics, LLM-as-judge         |
