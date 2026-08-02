# AI Patterns

RAG pipelines, the assistant's hand-rolled agent loop, guardrails, and observability.

<rules>
- ALWAYS use the LLM provider's NATIVE tool-calling API (via LiteLLM `tools=[...]` + `tool_calls` in the response) — never regex-parse ReAct-style text (text parsing breaks on any format variation)
- ALWAYS validate and sanitize both input and output of LLM calls in production (LLMs can generate PII, harmful content, or prompt injection responses)
- ALWAYS chunk documents with overlap for RAG ingestion (non-overlapping chunks lose context at boundaries, degrading retrieval quality)
- ALWAYS use LiteLLM's `aembedding()` for embeddings with `provider/model` format (consistent with completion API, enables provider switching)
- ALWAYS cap agent loops: iterations AND tool calls per iteration AND tool calls per request (unbounded loops burn tokens on runaway tool chains)
- NEVER skip output validation in production AI pipelines (unvalidated LLM output can contain PII, injection, or hallucinated harmful content)
</rules>

---

## The Assistant's Agent Loop (hand-rolled, no framework)

There is no agent framework here (no PydanticAI). The assistant implements
tool use directly on LiteLLM in `services/assistant/src/services/`:

- **`agent_loop.py`** — `run_agentic_loop()`: bounded loop
  (`MAX_TOOL_ITERS = 4`, `MAX_TOOL_CALLS_PER_ITER = 5`,
  `MAX_TOOL_CALLS_PER_REQUEST = 15`). Each iteration calls the LLM with the
  tool schemas; if the response has no `tool_calls`, stream the answer and
  stop. Otherwise execute the calls, append the `assistant` tool-call message
  plus one `tool` result message per call, and iterate. Events stream to the
  client as SSE (`format_sse`).
- **`tool_router.py`** — `ToolRouter` registry (`register()`/`get_tool()`) and
  `ActionDispatcher` for UI action-channel tools.
- **`agent_tools.py`** — tool implementations, `execute_tool()` dispatch, and
  `summarize_tool_result()` to keep tool output compact in context.

When adding a tool: define its JSON schema, register it on the router, handle
it in `execute_tool()`, and keep results summarized — raw tool dumps blow up
the context window.

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

## Vector Store (Qdrant)

`services/assistant/src/repositories/qdrant_repository.py` (and the
summarizer's ingestion side) use `qdrant-client`.

- Use **`query_points()`** — the old `search()` method was REMOVED from the
  client. Note the client calls are SYNC (mock with `MagicMock`, not
  `AsyncMock`, in tests).
- Filter by payload fields (video id, user id, language) and apply a
  `score_threshold`; cross-language retrieval works because embeddings are
  multilingual (sentence-transformers).

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

- **LiteLLM model format**: `provider/model` (slash), e.g. `anthropic/claude-sonnet-4-5`. Per-stage overrides come from `LLM_<STAGE>_MODEL` env vars — never hardcode model ids in call sites.
- **RAG score threshold**: Setting `min_score` too high (>0.85) returns no results for vague queries. Too low (<0.5) returns irrelevant noise. Start at 0.7 and tune per use case.
- **Token limits in context**: Truncate context to fit within model limits. Use `MODEL_CHAR_LIMITS` per model and `truncate_prompt_if_needed()` as a safety net.

---

## Rules Summary

Agents are hand-rolled on LiteLLM native tool calling with hard caps on iterations and tool calls — extend the existing loop (`agent_loop.py` / `tool_router.py` / `agent_tools.py`), don't introduce a framework. Build RAG pipelines with embed-retrieve-generate flow and overlapping chunks; retrieve from Qdrant with `query_points()`. Validate both LLM input (injection, moderation) and output (PII, safety) in production. Track costs and tokens via LiteLLM callbacks. Summarize conversation history and tool results to manage context windows.
