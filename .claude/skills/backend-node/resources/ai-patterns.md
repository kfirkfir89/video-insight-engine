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
import { generateText } from "ai";
import { models } from "../lib/ai/providers.js";
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

  // 4. Generate answer with context using AI SDK
  const result = await generateText({
    model: models.smart,
    system: `You are a helpful assistant. Answer based on the provided context.
If the context doesn't contain relevant information, say so.
Cite sources using [1], [2], etc.

Context:
${context}`,
    prompt: query,
    maxTokens: 1000,
  });

  return {
    answer: result.text,
    sources: results.map((r) => ({
      content: r.content.slice(0, 200) + "...",
      score: r.score,
      metadata: includeMetadata ? r.metadata : undefined,
    })),
    usage: {
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
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
import { embed, embedMany } from "ai";
import { openai } from "./ai/providers.js";

// Use AI SDK's embed function for consistency
export async function embedText(text: string): Promise<number[]> {
  const result = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });

  return result.embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const result = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: texts,
  });

  return result.embeddings;
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

## Agents with AI SDK

Use the Vercel AI SDK's built-in agent capabilities with `maxSteps` and `stopWhen` for cleaner, more reliable agents.

### DO ✅

```typescript
// services/agent.service.ts
import { generateText, tool } from "ai";
import { z } from "zod";
import { models } from "../lib/ai/providers.js";

// Define tools with proper Zod schemas
const searchKnowledgeTool = tool({
  description: "Search internal knowledge base for relevant information",
  parameters: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(5).describe("Max results"),
  }),
  execute: async ({ query, limit }) => {
    const results = await knowledgeService.search(query, limit);
    return results;
  },
});

const calculateTool = tool({
  description: "Perform mathematical calculations",
  parameters: z.object({
    expression: z.string().describe("Math expression to evaluate"),
  }),
  execute: async ({ expression }) => {
    // Use a safe math evaluator like mathjs in production
    const result = evaluateSafeMath(expression);
    return { result };
  },
});

const lookupUserTool = tool({
  description: "Get information about a user",
  parameters: z.object({
    userId: z.string().describe("The user ID to look up"),
  }),
  execute: async ({ userId }) => {
    const user = await userService.findById(userId);
    return user;
  },
});

// Signal tool for agent completion
const finishTool = tool({
  description: "Call this when you have the final answer",
  parameters: z.object({
    answer: z.string().describe("The final answer to return"),
    reasoning: z.string().optional().describe("Explanation of how you arrived at this answer"),
  }),
  // No execute - signal tool
});

interface AgentResult {
  answer: string;
  reasoning?: string;
  steps: number;
  toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
  totalTokens: number;
}

export async function runAgent(
  query: string,
  maxSteps = 10
): Promise<AgentResult> {
  const result = await generateText({
    model: models.smart,
    system: `You are a helpful assistant that solves problems step by step.
Use the available tools to gather information and perform calculations.
When you have the final answer, call the 'finish' tool with your answer.`,
    prompt: query,
    tools: {
      searchKnowledge: searchKnowledgeTool,
      calculate: calculateTool,
      lookupUser: lookupUserTool,
      finish: finishTool,
    },
    maxSteps,

    // Stop when finish tool is called
    stopWhen: (result) => {
      const lastStep = result.steps.at(-1);
      return lastStep?.toolCalls.some((tc) => tc.toolName === "finish") ?? false;
    },
  });

  // Extract finish tool call
  const finishCall = result.steps
    .flatMap((s) => s.toolCalls)
    .find((tc) => tc.toolName === "finish");

  // Collect all tool calls for observability
  const toolCalls = result.steps.flatMap((step, stepIndex) =>
    step.toolCalls.map((tc, callIndex) => ({
      tool: tc.toolName,
      args: tc.args,
      result: step.toolResults?.[callIndex]?.result,
    }))
  );

  return {
    answer: finishCall?.args.answer ?? result.text,
    reasoning: finishCall?.args.reasoning,
    steps: result.steps.length,
    toolCalls,
    totalTokens: result.usage.totalTokens,
  };
}
```

### Streaming Agent with Progress Updates

```typescript
import { streamText, tool } from "ai";
import { z } from "zod";

interface AgentProgress {
  type: "thinking" | "tool_call" | "tool_result" | "answer";
  content: string;
  metadata?: Record<string, unknown>;
}

export async function* streamAgent(
  query: string
): AsyncGenerator<AgentProgress> {
  const result = streamText({
    model: models.smart,
    system: `You are a helpful assistant. Use tools when needed.
Think step by step and explain your reasoning.`,
    prompt: query,
    tools: {
      search: searchKnowledgeTool,
      calculate: calculateTool,
    },
    maxSteps: 10,

    onStepFinish: async ({ stepType, toolCalls, toolResults }) => {
      // Log each step for observability
      logger.info("Agent step completed", { stepType, toolCalls: toolCalls?.length });
    },
  });

  // Stream thinking text
  for await (const chunk of result.textStream) {
    yield { type: "thinking", content: chunk };
  }

  // After stream completes, get final result
  const finalResult = await result;

  // Yield tool calls for UI display
  for (const step of finalResult.steps) {
    for (const tc of step.toolCalls) {
      yield {
        type: "tool_call",
        content: `Calling ${tc.toolName}`,
        metadata: { tool: tc.toolName, args: tc.args },
      };
    }
    for (const tr of step.toolResults ?? []) {
      yield {
        type: "tool_result",
        content: JSON.stringify(tr.result),
        metadata: { tool: tr.toolName },
      };
    }
  }

  yield { type: "answer", content: finalResult.text };
}
```

---

## Context Management

### DO ✅

```typescript
// services/context.service.ts
import { generateText } from "ai";
import { models } from "../lib/ai/providers.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

    // Use AI SDK with fast model for summarization
    const result = await generateText({
      model: models.fast, // Use cheaper/faster model
      system: "Summarize this conversation concisely, keeping key facts and decisions.",
      prompt: toSummarize.map((m) => `${m.role}: ${m.content}`).join("\n"),
      maxTokens: 500,
    });

    this.context.summary = result.text;
    this.context.messages = toKeep;
    this.context.totalTokens =
      countTokens(this.context.summary) +
      toKeep.reduce((sum, m) => sum + countTokens(m.content), 0);
  }

  getMessagesForAPI(): Message[] {
    const messages: Message[] = [];

    if (this.context.summary) {
      messages.push({
        role: "user",
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
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { models, openai } from "../lib/ai/providers.js";

// Input validation with prompt injection detection
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

  // Use OpenAI moderation API (still accessed via provider)
  // Note: Moderation API isn't part of AI SDK yet, use raw client
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input }),
  });

  const moderation = await response.json();

  if (moderation.results?.[0]?.flagged) {
    const categories = moderation.results[0].categories;
    Object.entries(categories).forEach(([cat, flagged]) => {
      if (flagged) issues.push(`Content flagged: ${cat}`);
    });
  }

  return { safe: issues.length === 0, issues };
}

// Output validation with PII detection
export async function validateOutput(output: string): Promise<{
  safe: boolean;
  sanitized: string;
  issues: string[];
}> {
  const issues: string[] = [];
  let sanitized = output;

  // Check for PII patterns
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

  return { safe: issues.length === 0, sanitized, issues };
}

// Safe completion wrapper using AI SDK
export async function safeCompletion(
  prompt: string,
  options: { model?: keyof typeof models } = {}
): Promise<{ content: string; filtered: boolean }> {
  // Validate input
  const inputCheck = await validateInput(prompt);
  if (!inputCheck.safe) {
    logger.warn("Input validation failed", { issues: inputCheck.issues });
    return { content: "I cannot process this request.", filtered: true };
  }

  // Generate response with AI SDK
  const result = await generateText({
    model: models[options.model ?? "smart"],
    prompt,
  });

  // Validate output
  const outputCheck = await validateOutput(result.text);

  if (!outputCheck.safe) {
    logger.warn("Output validation issues", { issues: outputCheck.issues });
  }

  return {
    content: outputCheck.sanitized,
    filtered: !outputCheck.safe,
  };
}

// AI-powered content classification for complex cases
const ContentClassificationSchema = z.object({
  safe: z.boolean(),
  category: z.enum(["safe", "harmful", "sensitive", "pii", "unknown"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

export async function classifyContent(content: string) {
  const result = await generateObject({
    model: models.fast,
    schema: ContentClassificationSchema,
    system: `You are a content safety classifier. Analyze the content and classify it.
Categories:
- safe: Normal, appropriate content
- harmful: Violent, illegal, or dangerous content
- sensitive: Adult, political, or controversial content
- pii: Contains personal identifiable information
- unknown: Cannot determine`,
    prompt: content,
  });

  return result.object;
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
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { generateObject } from "ai";
import { z } from "zod";
import { models } from "./ai/providers.js";

const tracer = trace.getTracer("ai-service");

// Trace AI calls with OpenTelemetry
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

// Structured logging for AI using AI SDK usage metadata
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

// Evaluation metrics using AI SDK's generateObject
const EvalResultSchema = z.object({
  score: z.number().min(1).max(5),
  feedback: z.string(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
});

type EvalResult = z.infer<typeof EvalResultSchema>;

export async function evaluateResponse(
  query: string,
  response: string,
  expectedBehavior: string
): Promise<EvalResult> {
  const result = await generateObject({
    model: models.smart,
    schema: EvalResultSchema,
    system: `Evaluate the AI response. Score 1-5 and explain.
Expected behavior: ${expectedBehavior}`,
    prompt: `Query: ${query}\n\nResponse: ${response}`,
  });

  return result.object;
}

// AI SDK provides automatic usage tracking in onFinish callback
// Use this pattern for comprehensive observability:
import { streamText } from "ai";

export function streamWithObservability(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  requestId: string
) {
  const startTime = Date.now();

  return streamText({
    model: models.smart,
    messages,

    onFinish: ({ usage, text }) => {
      const latencyMs = Date.now() - startTime;

      logAIRequest({
        model: "smart",
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        latencyMs,
        success: true,
      });

      // Emit metrics for dashboards
      metrics.histogram("ai.latency", latencyMs, { model: "smart" });
      metrics.counter("ai.tokens.input", usage.promptTokens);
      metrics.counter("ai.tokens.output", usage.completionTokens);
    },

    onError: (error) => {
      const latencyMs = Date.now() - startTime;

      logAIRequest({
        model: "smart",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        success: false,
        error: error.message,
      });
    },
  });
}
```

---

## Quick Reference

| Pattern    | When to Use                            | AI SDK Function    |
| ---------- | -------------------------------------- | ------------------ |
| MCP        | Connecting LLMs to external tools/data | N/A (separate SDK) |
| RAG        | Knowledge-base Q&A, document search    | `generateText`     |
| Agents     | Multi-step reasoning, complex tasks    | `generateText` + `maxSteps` + `stopWhen` |
| Guardrails | Production safety, compliance          | `generateObject` for classification |
| Memory     | Long-running conversations             | `generateText` for summarization |

| Component     | Tools                                |
| ------------- | ------------------------------------ |
| AI SDK        | `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic` |
| Vector DB     | Pinecone, Qdrant, pgvector, Weaviate |
| Embeddings    | `embed`, `embedMany` from AI SDK     |
| Observability | LangSmith, Helicone, OpenTelemetry   |
| Evaluation    | `generateObject` with eval schema    |

| AI SDK Function | Use Case |
| --------------- | -------- |
| `generateText`  | Non-interactive completions |
| `streamText`    | Real-time streaming with `onError`/`onFinish` |
| `generateObject`| Structured output with Zod schema |
| `streamObject`  | Streaming structured output |
| `embed`         | Single text embedding |
| `embedMany`     | Batch text embeddings |
| `tool`          | Define tools with Zod parameters |
