# AI Patterns

RAG pipelines, MCP servers, PydanticAI agents, guardrails, and observability.

<rules>
- ALWAYS use PydanticAI for agents with tools — never manual ReAct text parsing (regex-based tool parsing breaks on any LLM format variation)
- ALWAYS validate and sanitize both input and output of LLM calls in production (LLMs can generate PII, harmful content, or prompt injection responses)
- ALWAYS chunk documents with overlap for RAG ingestion (non-overlapping chunks lose context at boundaries, degrading retrieval quality)
- ALWAYS use LiteLLM's `aembedding()` for embeddings with `provider/model` format (consistent with completion API, enables provider switching)
- NEVER build manual ReAct loops with regex parsing (fragile, breaks on format variations, and PydanticAI handles this correctly)
- NEVER skip output validation in production AI pipelines (unvalidated LLM output can contain PII, injection, or hallucinated harmful content)
</rules>

---

## MCP Server

Define tools, resources, and handlers with the MCP SDK. Each tool has a name, description, and JSON Schema input.

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("my-mcp-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [Tool(
        name="search_documents",
        description="Search internal documents",
        inputSchema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    )]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    match name:
        case "search_documents":
            results = await doc_service.search(arguments["query"])
            return [TextContent(type="text", text=json.dumps(results))]
```

---

## RAG Pipeline

1. Embed query with `aembedding()`. 2. Retrieve top-k from vector store with min score threshold. 3. Build context from results. 4. Generate answer with context via `acompletion()`. Track cost with `completion_cost()`.

```python
async def rag_query(query: str, top_k: int = 5, min_score: float = 0.7) -> RAGResult:
    embedding = await embed_text(query)
    results = await vector_store.search(vector=embedding, top_k=top_k, min_score=min_score)
    context = "\n\n".join(f"[{i+1}] {r.content}" for i, r in enumerate(results))
    response = await acompletion(
        model="anthropic/claude-sonnet-4-20250514",
        messages=[{"role": "system", "content": f"Answer from context. Cite [1],[2].\n\n{context}"},
                  {"role": "user", "content": query}],
    )
    return RAGResult(answer=response.choices[0].message.content, sources=results)
```

Chunk documents with paragraph-aware splitting and configurable overlap (~50 chars). Batch embeddings in groups of 100.

---

## PydanticAI Agents

Create typed agents with dependency injection, structured output, and tool calling.

```python
@dataclass
class AgentDeps:
    knowledge: KnowledgeService
    user_id: str

agent = Agent(
    "anthropic:claude-sonnet-4-20250514",
    deps_type=AgentDeps,
    output_type=AgentOutput,
    system_prompt="You are a helpful assistant. Cite sources.",
)

@agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> list[dict]:
    return await ctx.deps.knowledge.search(query)

result = await agent.run(query, deps=deps)
```

Use `agent.run_stream()` for streaming. Use `@agent.system_prompt` for dynamic prompts based on user context. PydanticAI model format uses colon (`anthropic:model`), not slash.

---

## Guardrails

Validate input: check length, scan for prompt injection patterns, run moderation API. Validate output: scan for PII patterns (SSN, credit card, email, phone), run moderation, redact detected PII.

```python
async def safe_completion(prompt: str) -> tuple[str, bool]:
    input_check = await validate_input(prompt)
    if not input_check.safe:
        return "Cannot process this request.", True
    response = await acompletion(model=model, messages=[{"role": "user", "content": prompt}])
    output_check = await validate_output(response.choices[0].message.content or "")
    return output_check.sanitized, not output_check.safe
```

---

## Context Management & Observability

Summarize old messages when token count exceeds threshold using a fast model. Use OpenTelemetry spans for tracing AI calls. Log model, tokens, latency, cost, and success/failure for every LLM call.

---

## Edge Cases

- **PydanticAI vs LiteLLM model format**: PydanticAI uses `anthropic:model` (colon). LiteLLM uses `anthropic/model` (slash). For PydanticAI with LiteLLM backend, use `LiteLLMModel("anthropic/model")` adapter.
- **RAG score threshold**: Setting `min_score` too high (>0.85) returns no results for vague queries. Too low (<0.5) returns irrelevant noise. Start at 0.7 and tune per use case.
- **Token limits in context**: Truncate context to fit within model limits. Use `MODEL_CHAR_LIMITS` per model and `truncate_prompt_if_needed()` as a safety net.

---

## Rules Summary

Use PydanticAI for agents with typed tools and dependency injection — never manual ReAct parsing. Build RAG pipelines with embed-retrieve-generate flow and overlapping chunks. Implement MCP servers for tool connectivity. Validate both LLM input (injection, moderation) and output (PII, safety) in production. Track costs and tokens via LiteLLM callbacks. Use OpenTelemetry for tracing. Summarize conversation history to manage context windows. Choose the right model format for each framework.
