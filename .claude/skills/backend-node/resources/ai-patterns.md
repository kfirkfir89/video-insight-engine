# AI Patterns (Node.js)

Advanced patterns for building AI apps - RAG, MCP, agents, guardrails, and observability.

---

## MCP (Model Context Protocol)

### Server Setup

```typescript
// mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_documents",
      description: "Search internal documents",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results" },
        },
        required: ["query"],
      },
    },
    {
      name: "create_ticket",
      description: "Create a support ticket",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title", "description"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_documents": {
      const results = await documentService.search(args.query, args.limit);
      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    }
    case "create_ticket": {
      const ticket = await ticketService.create(args);
      return {
        content: [{ type: "text", text: `Created ticket: ${ticket.id}` }],
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Define resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "docs://handbook",
      name: "Employee Handbook",
      description: "Company policies and procedures",
      mimeType: "text/markdown",
    },
    {
      uri: "docs://api-reference",
      name: "API Reference",
      description: "API documentation",
      mimeType: "text/markdown",
    },
  ],
}));

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const content = await resourceService.getByUri(uri);
  return {
    contents: [{ uri, mimeType: "text/markdown", text: content }],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### MCP Client Usage

```typescript
// Using MCP tools in your app
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const mcpClient = new Client({ name: "my-app", version: "1.0.0" }, {});

// List available tools
const tools = await mcpClient.listTools();

// Call a tool
const result = await mcpClient.callTool({
  name: "search_documents",
  arguments: { query: "vacation policy", limit: 5 },
});
```

---

## RAG Pipeline

### DO ✅

```typescript
// services/rag.service.ts
import { getOpenAI } from "../lib/ai/clients.js";
import { vectorStore } from "../lib/vector/index.js";

interface RAGOptions {
  topK?: number;
  minScore?: number;
  includeMetadata?: boolean;
}

interface RAGResult {
  answer: string;
  sources: Array<{
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  usage: { inputTokens: number; outputTokens: number };
}

export async function ragQuery(
  query: string,
  options: RAGOptions = {}
): Promise<RAGResult> {
  const { topK = 5, minScore = 0.7, includeMetadata = true } = options;

  // 1. Embed the query
  const queryEmbedding = await embedText(query);

  // 2. Retrieve relevant documents
  const results = await vectorStore.search({
    vector: queryEmbedding,
    topK,
    filter: { score: { $gte: minScore } },
  });

  // 3. Build context from results
  const context = results.map((r, i) => `[${i + 1}] ${r.content}`).join("\n\n");

  // 4. Generate answer with context
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant. Answer based on the provided context.
If the context doesn't contain relevant information, say so.
Cite sources using [1], [2], etc.

Context:
${context}`,
      },
      { role: "user", content: query },
    ],
    max_tokens: 1000,
  });

  return {
    answer: response.choices[0]?.message?.content ?? "",
    sources: results.map((r) => ({
      content: r.content.slice(0, 200) + "...",
      score: r.score,
      metadata: includeMetadata ? r.metadata : undefined,
    })),
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
```

### Document Ingestion

```typescript
// services/ingest.service.ts
interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export async function ingestDocuments(documents: Document[]): Promise<void> {
  // 1. Chunk documents
  const chunks = documents.flatMap((doc) =>
    chunkText(doc.content, { chunkSize: 500, overlap: 50 }).map((chunk, i) => ({
      id: `${doc.id}-${i}`,
      content: chunk,
      metadata: { ...doc.metadata, chunkIndex: i, parentId: doc.id },
    }))
  );

  // 2. Generate embeddings in batches
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedTexts(batch.map((c) => c.content));

    // 3. Store in vector DB
    await vectorStore.upsert(
      batch.map((chunk, j) => ({
        id: chunk.id,
        vector: embeddings[j],
        metadata: { content: chunk.content, ...chunk.metadata },
      }))
    );
  }
}

// Text chunking with overlap
function chunkText(
  text: string,
  options: { chunkSize: number; overlap: number }
): string[] {
  const { chunkSize, overlap } = options;
  const chunks: string[] = [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // Keep overlap
      const words = currentChunk.split(" ");
      currentChunk =
        words.slice(-Math.floor(overlap / 5)).join(" ") + "\n\n" + para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

---

## Embeddings & Vector Store

### DO ✅

```typescript
// lib/embeddings.ts
import { getOpenAI } from "./ai/clients.js";

export async function embedText(text: string): Promise<number[]> {
  const client = getOpenAI();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenAI();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return response.data.map((d) => d.embedding);
}

// Similarity calculation
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Pinecone Integration

```typescript
// lib/vector/pinecone.ts
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({ apiKey: config.PINECONE_API_KEY });
const index = pinecone.index(config.PINECONE_INDEX);

export const vectorStore = {
  async upsert(
    vectors: Array<{
      id: string;
      vector: number[];
      metadata: Record<string, unknown>;
    }>
  ) {
    await index.upsert(vectors);
  },

  async search(params: {
    vector: number[];
    topK: number;
    filter?: Record<string, unknown>;
  }) {
    const results = await index.query({
      vector: params.vector,
      topK: params.topK,
      filter: params.filter,
      includeMetadata: true,
    });

    return results.matches.map((m) => ({
      id: m.id,
      score: m.score ?? 0,
      content: m.metadata?.content as string,
      metadata: m.metadata,
    }));
  },

  async delete(ids: string[]) {
    await index.deleteMany(ids);
  },
};
```

### pgvector Integration

```typescript
// lib/vector/pgvector.ts
import { Pool } from "pg";

const pool = new Pool({ connectionString: config.DATABASE_URL });

export const vectorStore = {
  async upsert(
    vectors: Array<{
      id: string;
      vector: number[];
      metadata: Record<string, unknown>;
    }>
  ) {
    const client = await pool.connect();
    try {
      for (const v of vectors) {
        await client.query(
          `INSERT INTO embeddings (id, embedding, metadata, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             embedding = EXCLUDED.embedding,
             metadata = EXCLUDED.metadata,
             content = EXCLUDED.content`,
          [v.id, JSON.stringify(v.vector), v.metadata, v.metadata.content]
        );
      }
    } finally {
      client.release();
    }
  },

  async search(params: { vector: number[]; topK: number }) {
    const result = await pool.query(
      `SELECT id, content, metadata, 
              1 - (embedding <=> $1::vector) as score
       FROM embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(params.vector), params.topK]
    );

    return result.rows;
  },
};
```

---

## Agents & Planning

### DO ✅

```typescript
// services/agent.service.ts
interface AgentStep {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation?: string;
}

interface AgentResult {
  answer: string;
  steps: AgentStep[];
  totalTokens: number;
}

const AGENT_SYSTEM_PROMPT = `You are an AI assistant that solves problems step by step.

For each step, respond with:
THOUGHT: Your reasoning about what to do next
ACTION: The tool to use (or "FINISH" if done)
ACTION_INPUT: JSON input for the tool

Available tools:
- search_knowledge: Search internal knowledge base
- calculate: Perform calculations
- lookup_user: Get user information

When you have the final answer, use ACTION: FINISH with the answer in ACTION_INPUT.`;

export async function runAgent(
  query: string,
  maxSteps = 10
): Promise<AgentResult> {
  const client = getOpenAI();
  const steps: AgentStep[] = [];
  let totalTokens = 0;

  const messages: Message[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: query },
  ];

  for (let i = 0; i < maxSteps; i++) {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
    });

    totalTokens += response.usage?.total_tokens ?? 0;
    const content = response.choices[0]?.message?.content ?? "";

    // Parse response
    const thought =
      content.match(/THOUGHT:\s*(.+?)(?=ACTION:|$)/s)?.[1]?.trim() ?? "";
    const action =
      content.match(/ACTION:\s*(.+?)(?=ACTION_INPUT:|$)/s)?.[1]?.trim() ?? "";
    const actionInputStr =
      content.match(/ACTION_INPUT:\s*(.+?)$/s)?.[1]?.trim() ?? "{}";

    let actionInput: Record<string, unknown>;
    try {
      actionInput = JSON.parse(actionInputStr);
    } catch {
      actionInput = { raw: actionInputStr };
    }

    const step: AgentStep = { thought, action, actionInput };

    // Check if done
    if (action.toUpperCase() === "FINISH") {
      return {
        answer: (actionInput.answer as string) ?? actionInputStr,
        steps,
        totalTokens,
      };
    }

    // Execute tool
    const observation = await executeTool(action, actionInput);
    step.observation = observation;
    steps.push(step);

    // Add to conversation
    messages.push({ role: "assistant", content });
    messages.push({ role: "user", content: `OBSERVATION: ${observation}` });
  }

  return {
    answer: "Max steps reached without conclusion",
    steps,
    totalTokens,
  };
}

async function executeTool(
  action: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (action.toLowerCase()) {
    case "search_knowledge":
      const results = await knowledgeService.search(input.query as string);
      return JSON.stringify(results);
    case "calculate":
      return String(eval(input.expression as string)); // Use safe evaluator in production!
    case "lookup_user":
      const user = await userService.findById(input.userId as string);
      return JSON.stringify(user);
    default:
      return `Unknown tool: ${action}`;
  }
}
```

---

## Context Management

### DO ✅

```typescript
// services/context.service.ts
interface ConversationContext {
  messages: Message[];
  summary?: string;
  totalTokens: number;
}

const MAX_CONTEXT_TOKENS = 8000;
const SUMMARIZE_THRESHOLD = 6000;

export class ContextManager {
  private context: ConversationContext = {
    messages: [],
    totalTokens: 0,
  };

  async addMessage(message: Message): Promise<void> {
    this.context.messages.push(message);
    this.context.totalTokens += countTokens(message.content);

    // Summarize if getting too long
    if (this.context.totalTokens > SUMMARIZE_THRESHOLD) {
      await this.summarizeOldMessages();
    }
  }

  private async summarizeOldMessages(): Promise<void> {
    // Keep last few messages, summarize the rest
    const keepCount = 4;
    const toSummarize = this.context.messages.slice(0, -keepCount);
    const toKeep = this.context.messages.slice(-keepCount);

    if (toSummarize.length < 2) return;

    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Cheaper for summarization
      messages: [
        {
          role: "system",
          content:
            "Summarize this conversation concisely, keeping key facts and decisions.",
        },
        {
          role: "user",
          content: toSummarize.map((m) => `${m.role}: ${m.content}`).join("\n"),
        },
      ],
      max_tokens: 500,
    });

    this.context.summary = response.choices[0]?.message?.content ?? "";
    this.context.messages = toKeep;
    this.context.totalTokens =
      countTokens(this.context.summary) +
      toKeep.reduce((sum, m) => sum + countTokens(m.content), 0);
  }

  getMessagesForAPI(): Message[] {
    const messages: Message[] = [];

    if (this.context.summary) {
      messages.push({
        role: "system",
        content: `Previous conversation summary:\n${this.context.summary}`,
      });
    }

    messages.push(...this.context.messages);
    return messages;
  }
}
```

---

## Prompt Engineering

### DO ✅

```typescript
// lib/prompts/templates.ts

// Few-shot template
export function fewShotPrompt(
  task: string,
  examples: Array<{ input: string; output: string }>,
  input: string
): string {
  const exampleText = examples
    .map((e) => `Input: ${e.input}\nOutput: ${e.output}`)
    .join("\n\n");

  return `${task}

Examples:
${exampleText}

Now process this:
Input: ${input}
Output:`;
}

// Chain of thought
export function chainOfThoughtPrompt(question: string): string {
  return `${question}

Let's think through this step by step:
1.`;
}

// Structured extraction
export function extractionPrompt(
  text: string,
  schema: Record<string, string>
): string {
  const fields = Object.entries(schema)
    .map(([key, desc]) => `- ${key}: ${desc}`)
    .join("\n");

  return `Extract the following information from the text:

${fields}

Text:
${text}

Respond in JSON format.`;
}

// System prompts for different personas
export const SYSTEM_PROMPTS = {
  assistant: `You are a helpful AI assistant. Be concise and accurate.`,

  coder: `You are an expert programmer. Write clean, well-documented code.
Always explain your approach before writing code.
Use best practices and modern patterns.`,

  analyst: `You are a data analyst. Focus on insights and patterns.
Support claims with data. Be precise with numbers.
Present findings in a clear, structured way.`,

  writer: `You are a skilled writer. Focus on clarity and engagement.
Adapt tone to the audience. Be creative but accurate.`,
};
```

---

## Guardrails & Safety

### DO ✅

```typescript
// services/guardrails.service.ts

// Input validation
export async function validateInput(input: string): Promise<{
  safe: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check length
  if (input.length > 10000) {
    issues.push("Input too long");
  }

  // Check for prompt injection patterns
  const injectionPatterns = [
    /ignore previous instructions/i,
    /disregard all prior/i,
    /forget everything/i,
    /you are now/i,
    /new persona/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(input)) {
      issues.push("Potential prompt injection detected");
      break;
    }
  }

  // Use moderation API
  const client = getOpenAI();
  const moderation = await client.moderations.create({ input });

  if (moderation.results[0].flagged) {
    const categories = moderation.results[0].categories;
    Object.entries(categories).forEach(([cat, flagged]) => {
      if (flagged) issues.push(`Content flagged: ${cat}`);
    });
  }

  return { safe: issues.length === 0, issues };
}

// Output validation
export async function validateOutput(output: string): Promise<{
  safe: boolean;
  sanitized: string;
  issues: string[];
}> {
  const issues: string[] = [];
  let sanitized = output;

  // Check for PII
  const piiPatterns = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  };

  for (const [type, pattern] of Object.entries(piiPatterns)) {
    if (pattern.test(output)) {
      issues.push(`PII detected: ${type}`);
      sanitized = sanitized.replace(
        pattern,
        `[REDACTED ${type.toUpperCase()}]`
      );
    }
  }

  // Check for harmful content
  const client = getOpenAI();
  const moderation = await client.moderations.create({ input: output });

  if (moderation.results[0].flagged) {
    issues.push("Output flagged by moderation");
  }

  return { safe: issues.length === 0, sanitized, issues };
}

// Wrapper with guardrails
export async function safeCompletion(
  prompt: string,
  options: CompletionOptions = {}
): Promise<{ content: string; filtered: boolean }> {
  // Validate input
  const inputCheck = await validateInput(prompt);
  if (!inputCheck.safe) {
    return { content: "I cannot process this request.", filtered: true };
  }

  // Generate response
  const response = await complete(prompt, options);

  // Validate output
  const outputCheck = await validateOutput(response);

  return {
    content: outputCheck.sanitized,
    filtered: !outputCheck.safe,
  };
}
```

---

## Conversation Memory

### DO ✅

```typescript
// services/memory.service.ts
interface ConversationMemory {
  id: string;
  userId: string;
  messages: Message[];
  summary?: string;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
  };
}

export class MemoryService {
  async saveConversation(
    userId: string,
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    const existing = await db.conversations.findOne({ id: conversationId });

    if (existing) {
      await db.conversations.updateOne(
        { id: conversationId },
        {
          $set: {
            messages,
            "metadata.updatedAt": new Date(),
            "metadata.messageCount": messages.length,
          },
        }
      );
    } else {
      await db.conversations.insertOne({
        id: conversationId,
        userId,
        messages,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: messages.length,
        },
      });
    }
  }

  async loadConversation(conversationId: string): Promise<Message[]> {
    const conv = await db.conversations.findOne({ id: conversationId });
    return conv?.messages ?? [];
  }

  async searchConversations(
    userId: string,
    query: string
  ): Promise<ConversationMemory[]> {
    // Search using vector similarity
    const queryEmbedding = await embedText(query);

    return await db.conversations
      .aggregate([
        { $match: { userId } },
        {
          $addFields: {
            similarity: {
              $function: {
                body: "function(a, b) { /* cosine similarity */ }",
                args: ["$embedding", queryEmbedding],
                lang: "js",
              },
            },
          },
        },
        { $sort: { similarity: -1 } },
        { $limit: 10 },
      ])
      .toArray();
  }
}
```

---

## Observability & Evaluation

### DO ✅

```typescript
// lib/observability.ts
import { trace, context, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("ai-service");

// Trace AI calls
export async function tracedCompletion<T>(
  name: string,
  fn: () => Promise<T>,
  attributes: Record<string, string | number> = {}
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes);
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Structured logging for AI
export function logAIRequest(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}): void {
  logger.info("ai_request", {
    ...params,
    cost: calculateCost(params.model, params.inputTokens, params.outputTokens),
  });
}

// Evaluation metrics
interface EvalResult {
  score: number;
  feedback: string;
}

export async function evaluateResponse(
  query: string,
  response: string,
  expectedBehavior: string
): Promise<EvalResult> {
  const client = getOpenAI();

  const result = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Evaluate the AI response. Score 1-5 and explain.
Expected behavior: ${expectedBehavior}`,
      },
      {
        role: "user",
        content: `Query: ${query}\n\nResponse: ${response}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = JSON.parse(result.choices[0]?.message?.content ?? "{}");
  return {
    score: content.score ?? 0,
    feedback: content.feedback ?? "",
  };
}
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
