# AI Patterns (Node.js)

RAG pipelines, MCP servers, agents, embeddings, guardrails, context management, and observability.

<rules>
- ALWAYS chunk documents with overlap for RAG — 500 chars chunk, 50 chars overlap (causes lost context at chunk boundaries if no overlap)
- ALWAYS validate both input and output of AI calls — check for prompt injection and PII leakage (causes security vulnerabilities and compliance violations)
- ALWAYS use AI SDK's `embed`/`embedMany` for embeddings — batch in groups of 100 (causes rate limits if sending all at once)
- ALWAYS use `maxSteps` + `stopWhen` for agents — define a finish signal tool (causes infinite loops without termination condition)
- ALWAYS track AI observability: latency, tokens, cost, success/failure per model (causes undetected cost overruns and degradation)
- NEVER inject user input directly into system prompts without sanitization (causes prompt injection attacks)
- NEVER store raw conversation history without size management (causes context window overflow and increasing costs)
</rules>

---

## MCP Server

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'my-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: 'search_docs', description: 'Search documents',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'search_docs') {
    return { content: [{ type: 'text', text: JSON.stringify(await docService.search(args.query)) }] };
  }
  throw new Error(`Unknown tool: ${name}`);
});
await server.connect(new StdioServerTransport());
```

---

## RAG Pipeline

```typescript
export async function ragQuery(query: string, topK = 5, minScore = 0.7): Promise<RAGResult> {
  const queryEmbedding = await embedText(query);
  const results = await vectorStore.search({ vector: queryEmbedding, topK, filter: { score: { $gte: minScore } } });
  const context = results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');

  const result = await generateText({
    model: models.smart,
    system: `Answer based on context. Cite sources as [1], [2].\n\nContext:\n${context}`,
    prompt: query,
  });

  return { answer: result.text, sources: results.map(r => ({ content: r.content.slice(0, 200), score: r.score })) };
}
```

---

## Document Ingestion

Chunk with overlap, embed in batches, store in vector DB:

```typescript
export async function ingestDocuments(documents: Document[]) {
  const chunks = documents.flatMap(doc =>
    chunkText(doc.content, { chunkSize: 500, overlap: 50 })
      .map((chunk, i) => ({ id: `${doc.id}-${i}`, content: chunk, metadata: { ...doc.metadata, parentId: doc.id } }))
  );
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100);
    const embeddings = await embedTexts(batch.map(c => c.content));
    await vectorStore.upsert(batch.map((chunk, j) => ({ id: chunk.id, vector: embeddings[j], metadata: { content: chunk.content, ...chunk.metadata } })));
  }
}
```

---

## Agent with Stop Condition

```typescript
const finishTool = tool({
  description: 'Call when you have the final answer',
  parameters: z.object({ answer: z.string(), confidence: z.number().min(0).max(1) }),
});

const result = await generateText({
  model: models.smart,
  prompt: query,
  tools: { search: searchTool, finish: finishTool },
  maxSteps: 10,
  stopWhen: (r) => r.steps.at(-1)?.toolCalls.some(tc => tc.toolName === 'finish') ?? false,
});

const answer = result.steps.flatMap(s => s.toolCalls).find(tc => tc.toolName === 'finish')?.args.answer ?? result.text;
```

---

## Guardrails

```typescript
// Input: prompt injection detection
const injectionPatterns = [/ignore previous instructions/i, /you are now/i, /forget everything/i];
function checkInjection(input: string): boolean {
  return injectionPatterns.some(p => p.test(input));
}

// Output: PII detection and redaction
const piiPatterns = { ssn: /\b\d{3}-\d{2}-\d{4}\b/g, creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g };
function redactPII(text: string): string {
  let result = text;
  for (const [type, pattern] of Object.entries(piiPatterns)) {
    result = result.replace(pattern, `[REDACTED ${type.toUpperCase()}]`);
  }
  return result;
}
```

---

## Context Management

Summarize old messages when approaching token limits. Keep last N messages intact:

```typescript
class ContextManager {
  private messages: Message[] = [];
  private summary?: string;

  async addMessage(msg: Message) {
    this.messages.push(msg);
    if (countTokens(this.messages) > 6000) {
      const old = this.messages.slice(0, -4);
      this.summary = (await generateText({ model: models.fast, prompt: old.map(m => `${m.role}: ${m.content}`).join('\n'), system: 'Summarize concisely.', maxTokens: 500 })).text;
      this.messages = this.messages.slice(-4);
    }
  }
}
```

---

## Edge Cases

- **Empty vector search results**: When no documents meet `minScore`, return a "no relevant information found" response rather than hallucinating.
- **Agent infinite loop**: Even with `maxSteps: 10`, a poorly-prompted agent may cycle without calling the finish tool. Set a timeout and return partial results.
- **Embedding dimension mismatch**: Ensure the vector store index dimension matches the embedding model output (e.g., text-embedding-3-small = 1536).

---

## Rules Summary

RAG pipelines chunk documents with overlap, embed in batches, and retrieve by vector similarity with a minimum score threshold. MCP servers expose tools and resources via the Model Context Protocol SDK. Agents use `maxSteps` with a `stopWhen` condition and finish signal tool to prevent infinite loops. Guardrails validate input for prompt injection and redact PII from output. Context managers summarize old messages to stay within token limits. All AI operations track latency, tokens, cost, and success/failure for observability.
