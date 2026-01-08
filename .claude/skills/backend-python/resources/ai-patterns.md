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
from lib.ai.clients import get_openai
from lib.vector import vector_store
from lib.embeddings import embed_text


class RAGOptions(BaseModel):
    top_k: int = 5
    min_score: float = 0.7
    include_metadata: bool = True


class Source(BaseModel):
    content: str
    score: float
    metadata: dict | None = None


class RAGResult(BaseModel):
    answer: str
    sources: list[Source]
    usage: dict[str, int]


async def rag_query(query: str, options: RAGOptions | None = None) -> RAGResult:
    """Execute RAG query."""
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

    # 4. Generate answer with context
    client = get_openai()

    response = await client.chat.completions.create(
        model="gpt-4o",
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
from lib.ai.clients import get_openai


async def embed_text(text: str) -> list[float]:
    """Generate embedding for text."""
    client = get_openai()

    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )

    return response.data[0].embedding


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts."""
    client = get_openai()

    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )

    return [d.embedding for d in response.data]


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

## Agents & Planning

### DO ✅

```python
# services/agent_service.py
from pydantic import BaseModel
from lib.ai.clients import get_openai
import re


class AgentStep(BaseModel):
    thought: str
    action: str
    action_input: dict
    observation: str | None = None


class AgentResult(BaseModel):
    answer: str
    steps: list[AgentStep]
    total_tokens: int


AGENT_SYSTEM_PROMPT = """You are an AI assistant that solves problems step by step.

For each step, respond with:
THOUGHT: Your reasoning about what to do next
ACTION: The tool to use (or "FINISH" if done)
ACTION_INPUT: JSON input for the tool

Available tools:
- search_knowledge: Search internal knowledge base
- calculate: Perform calculations
- lookup_user: Get user information

When you have the final answer, use ACTION: FINISH with the answer in ACTION_INPUT."""


async def run_agent(query: str, max_steps: int = 10) -> AgentResult:
    """Run agent to completion."""
    client = get_openai()
    steps: list[AgentStep] = []
    total_tokens = 0

    messages = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]

    for _ in range(max_steps):
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=500,
        )

        total_tokens += response.usage.total_tokens if response.usage else 0
        content = response.choices[0].message.content or ""

        # Parse response
        thought = _extract(content, r"THOUGHT:\s*(.+?)(?=ACTION:|$)")
        action = _extract(content, r"ACTION:\s*(.+?)(?=ACTION_INPUT:|$)")
        action_input_str = _extract(content, r"ACTION_INPUT:\s*(.+?)$")

        try:
            action_input = json.loads(action_input_str)
        except json.JSONDecodeError:
            action_input = {"raw": action_input_str}

        step = AgentStep(thought=thought, action=action, action_input=action_input)

        # Check if done
        if action.upper() == "FINISH":
            return AgentResult(
                answer=action_input.get("answer", action_input_str),
                steps=steps,
                total_tokens=total_tokens,
            )

        # Execute tool
        observation = await execute_tool(action, action_input)
        step.observation = observation
        steps.append(step)

        # Add to conversation
        messages.append({"role": "assistant", "content": content})
        messages.append({"role": "user", "content": f"OBSERVATION: {observation}"})

    return AgentResult(
        answer="Max steps reached without conclusion",
        steps=steps,
        total_tokens=total_tokens,
    )


def _extract(text: str, pattern: str) -> str:
    """Extract text using regex."""
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""


async def execute_tool(action: str, input: dict) -> str:
    """Execute agent tool."""
    match action.lower():
        case "search_knowledge":
            results = await knowledge_service.search(input.get("query", ""))
            return json.dumps(results)
        case "calculate":
            # Use safe evaluator in production!
            return str(eval(input.get("expression", "0")))
        case "lookup_user":
            user = await user_service.find_by_id(input.get("user_id", ""))
            return json.dumps(user)
        case _:
            return f"Unknown tool: {action}"
```

---

## Context Management

### DO ✅

```python
# services/context_service.py
from pydantic import BaseModel
from lib.ai.clients import get_openai
from lib.tokens import count_tokens


class ConversationContext(BaseModel):
    messages: list[Message] = []
    summary: str | None = None
    total_tokens: int = 0


MAX_CONTEXT_TOKENS = 8000
SUMMARIZE_THRESHOLD = 6000


class ContextManager:
    def __init__(self):
        self.context = ConversationContext()

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

        client = get_openai()
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
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
import re


class ValidationResult(BaseModel):
    safe: bool
    issues: list[str]


class OutputValidation(BaseModel):
    safe: bool
    sanitized: str
    issues: list[str]


async def validate_input(input: str) -> ValidationResult:
    """Validate user input for safety."""
    issues: list[str] = []

    # Check length
    if len(input) > 10000:
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
        if re.search(pattern, input, re.IGNORECASE):
            issues.append("Potential prompt injection detected")
            break

    # Use moderation API
    client = get_openai()
    moderation = await client.moderations.create(input=input)

    if moderation.results[0].flagged:
        categories = moderation.results[0].categories
        for cat, flagged in categories.model_dump().items():
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

    # Check for harmful content
    client = get_openai()
    moderation = await client.moderations.create(input=output)

    if moderation.results[0].flagged:
        issues.append("Output flagged by moderation")

    return OutputValidation(safe=len(issues) == 0, sanitized=sanitized, issues=issues)


async def safe_completion(
    prompt: str,
    options: CompletionOptions | None = None
) -> tuple[str, bool]:
    """Complete with safety guardrails."""
    # Validate input
    input_check = await validate_input(prompt)
    if not input_check.safe:
        return "I cannot process this request.", True

    # Generate response
    response = await complete(prompt, options)

    # Validate output
    output_check = await validate_output(response)

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
import structlog
from functools import wraps
from typing import Callable, TypeVar, ParamSpec

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
        cost=calculate_cost(model, input_tokens, output_tokens),
    )


class EvalResult(BaseModel):
    score: float
    feedback: str


async def evaluate_response(
    query: str,
    response: str,
    expected_behavior: str
) -> EvalResult:
    """Evaluate AI response quality."""
    client = get_openai()

    result = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": f"""Evaluate the AI response. Score 1-5 and explain.
Expected behavior: {expected_behavior}""",
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
```

---

## Quick Reference

| Pattern    | When to Use                            |
| ---------- | -------------------------------------- |
| MCP        | Connecting LLMs to external tools/data |
| RAG        | Knowledge-base Q&A, document search    |
| Agents     | Multi-step reasoning, complex tasks    |
| Guardrails | Production safety, compliance          |
| Memory     | Long-running conversations             |

| Component     | Tools                                |
| ------------- | ------------------------------------ |
| Vector DB     | Pinecone, Qdrant, pgvector, Weaviate |
| Observability | LangSmith, Helicone, OpenTelemetry   |
| Evaluation    | Custom metrics, LLM-as-judge         |
