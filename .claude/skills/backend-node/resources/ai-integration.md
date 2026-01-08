# AI Integration (Node.js)

Core patterns for calling LLMs - SDK setup, streaming, tools, and production essentials.

---

## SDK Setup

### DO ✅

```typescript
// lib/ai/clients.ts
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

// Singleton clients
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return openaiClient;
}

export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// Types
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
```

### DON'T ❌

```typescript
// New client per request (wasteful)
app.post("/chat", async (req) => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
});

// Hardcoded keys
const client = new OpenAI({ apiKey: "sk-..." });
```

---

## Basic Completion

### DO ✅

```typescript
// services/ai.service.ts
export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<string> {
  const {
    model = "gpt-4o",
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt = "You are a helpful assistant.",
  } = options;

  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}

// Claude completion
export async function completeClaude(
  prompt: string,
  options: CompletionOptions = {}
): Promise<string> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: options.model ?? "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens ?? 1024,
    system: options.systemPrompt ?? "You are a helpful assistant.",
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
```

---

## Streaming Responses

### DO ✅

```typescript
// OpenAI streaming generator
export async function* streamCompletion(
  messages: Message[],
  options: CompletionOptions = {}
): AsyncGenerator<string> {
  const client = getOpenAI();

  const stream = await client.chat.completions.create({
    model: options.model ?? "gpt-4o",
    max_tokens: options.maxTokens ?? 1000,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// Claude streaming generator
export async function* streamClaudeCompletion(
  messages: Message[]
): AsyncGenerator<string> {
  const client = getAnthropic();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
```

---

## SSE Endpoint (Fastify)

### DO ✅

```typescript
// routes/chat.routes.ts
import { FastifyRequest, FastifyReply } from "fastify";

interface ChatBody {
  messages: Message[];
  model?: string;
}

export async function streamChatHandler(
  request: FastifyRequest<{ Body: ChatBody }>,
  reply: FastifyReply
): Promise<void> {
  const { messages, model } = request.body;

  // Set SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    for await (const chunk of streamCompletion(messages, { model })) {
      reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    reply.raw.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
  } finally {
    reply.raw.end();
  }
}
```

---

## Structured Output (JSON Mode)

### DO ✅

```typescript
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Define schema
const ExtractedDataSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1),
});

type ExtractedData = z.infer<typeof ExtractedDataSchema>;

export async function extractStructured(text: string): Promise<ExtractedData> {
  const client = getOpenAI();

  const response = await client.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Extract structured data from the text." },
      { role: "user", content: text },
    ],
    response_format: zodResponseFormat(ExtractedDataSchema, "extracted_data"),
  });

  const parsed = response.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("Failed to parse response");

  return parsed;
}
```

---

## Function Calling / Tools

### DO ✅

```typescript
// Define tools
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search internal knowledge base for relevant information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  },
];

// Tool handlers
const toolHandlers: Record<string, (args: unknown) => Promise<string>> = {
  search_knowledge_base: async (args) => {
    const { query, limit = 5 } = args as { query: string; limit?: number };
    const results = await knowledgeService.search(query, limit);
    return JSON.stringify(results);
  },
  get_current_weather: async (args) => {
    const { location, unit = "celsius" } = args as {
      location: string;
      unit?: string;
    };
    const weather = await weatherService.get(location, unit);
    return JSON.stringify(weather);
  },
};

// Execute with tool loop
export async function chatWithTools(messages: Message[]): Promise<string> {
  const client = getOpenAI();
  let currentMessages = [...messages];

  while (true) {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: currentMessages,
      tools,
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("No response");

    // No tool calls - return final response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? "";
    }

    // Execute tool calls
    currentMessages.push(message);

    for (const toolCall of message.tool_calls) {
      const handler = toolHandlers[toolCall.function.name];
      if (!handler) throw new Error(`Unknown tool: ${toolCall.function.name}`);

      const args = JSON.parse(toolCall.function.arguments);
      const result = await handler(args);

      currentMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }
}
```

---

## Error Handling & Fallbacks

### DO ✅

```typescript
import { APIError, RateLimitError, APITimeoutError } from "openai";

interface AIConfig {
  primary: { provider: "openai" | "anthropic"; model: string };
  fallback?: { provider: "openai" | "anthropic"; model: string };
}

const defaultConfig: AIConfig = {
  primary: { provider: "openai", model: "gpt-4o" },
  fallback: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
};

export async function safeComplete(
  prompt: string,
  config: AIConfig = defaultConfig
): Promise<string> {
  try {
    return await completeWithProvider(prompt, config.primary);
  } catch (error) {
    // Log primary failure
    logger.warn("Primary AI failed, trying fallback", { error, config });

    if (config.fallback) {
      try {
        return await completeWithProvider(prompt, config.fallback);
      } catch (fallbackError) {
        logger.error("Fallback AI also failed", { error: fallbackError });
      }
    }

    // Handle specific errors
    if (error instanceof RateLimitError) {
      throw new AppError("AI rate limit exceeded", 429, "AI_RATE_LIMIT");
    }
    if (error instanceof APITimeoutError) {
      throw new AppError("AI request timed out", 504, "AI_TIMEOUT");
    }
    if (error instanceof APIError && error.status === 401) {
      throw new AppError("AI authentication failed", 500, "AI_AUTH_ERROR");
    }

    throw new AppError("AI service unavailable", 503, "AI_ERROR");
  }
}

async function completeWithProvider(
  prompt: string,
  config: { provider: string; model: string }
): Promise<string> {
  if (config.provider === "anthropic") {
    return completeClaude(prompt, { model: config.model });
  }
  return complete(prompt, { model: config.model });
}
```

---

## Token Management

### DO ✅

```typescript
import { encoding_for_model, TiktokenModel } from "tiktoken";

// Cache encoders
const encoderCache = new Map<string, ReturnType<typeof encoding_for_model>>();

function getEncoder(model: string) {
  if (!encoderCache.has(model)) {
    encoderCache.set(model, encoding_for_model(model as TiktokenModel));
  }
  return encoderCache.get(model)!;
}

export function countTokens(text: string, model = "gpt-4o"): number {
  const encoder = getEncoder(model);
  return encoder.encode(text).length;
}

export function countMessagesTokens(
  messages: Message[],
  model = "gpt-4o"
): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content, model);
    total += 4; // Role + formatting overhead
  }
  return total + 2; // Priming tokens
}

export function truncateToFit(
  messages: Message[],
  maxTokens: number,
  model = "gpt-4o"
): Message[] {
  const result: Message[] = [];
  let currentTokens = 0;

  // Always keep system message
  const systemMsg = messages.find((m) => m.role === "system");
  if (systemMsg) {
    currentTokens += countTokens(systemMsg.content, model) + 4;
    result.push(systemMsg);
  }

  // Add messages from most recent, stop at limit
  const otherMsgs = messages.filter((m) => m.role !== "system").reverse();

  for (const msg of otherMsgs) {
    const msgTokens = countTokens(msg.content, model) + 4;
    if (currentTokens + msgTokens > maxTokens) break;
    currentTokens += msgTokens;
    result.splice(systemMsg ? 1 : 0, 0, msg);
  }

  return result;
}
```

---

## Cost Tracking

### DO ✅

```typescript
// Pricing per 1M tokens (update as needed)
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
};

interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
  userId?: string;
  requestId?: string;
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

export async function trackUsage(usage: UsageRecord): Promise<void> {
  await db.aiUsage.insertOne(usage);

  // Alert on high usage
  const dailyTotal = await getDailyUsage(usage.userId);
  if (dailyTotal > config.AI_DAILY_COST_LIMIT) {
    await alertService.send("AI cost limit exceeded", { usage, dailyTotal });
  }
}

// Wrapper that tracks usage
export async function completionWithTracking(
  prompt: string,
  options: CompletionOptions & { userId?: string; requestId?: string } = {}
): Promise<{ content: string; usage: UsageRecord }> {
  const client = getOpenAI();
  const model = options.model ?? "gpt-4o";

  const response = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens ?? 1000,
    messages: [
      { role: "system", content: options.systemPrompt ?? "You are helpful." },
      { role: "user", content: prompt },
    ],
  });

  const usage: UsageRecord = {
    model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    cost: calculateCost(
      model,
      response.usage?.prompt_tokens ?? 0,
      response.usage?.completion_tokens ?? 0
    ),
    timestamp: new Date(),
    userId: options.userId,
    requestId: options.requestId,
  };

  await trackUsage(usage);

  return {
    content: response.choices[0]?.message?.content ?? "",
    usage,
  };
}
```

---

## Multi-Modal (Images)

### DO ✅

```typescript
interface ImageInput {
  type: "url" | "base64";
  data: string;
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export async function analyzeImage(
  image: ImageInput,
  prompt: string
): Promise<string> {
  const client = getOpenAI();

  const imageContent =
    image.type === "url"
      ? { type: "image_url" as const, image_url: { url: image.data } }
      : {
          type: "image_url" as const,
          image_url: {
            url: `data:${image.mediaType ?? "image/jpeg"};base64,${image.data}`,
          },
        };

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, imageContent],
      },
    ],
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content ?? "";
}
```

---

## Quick Reference

| Pattern           | When to Use                      |
| ----------------- | -------------------------------- |
| Basic Completion  | Simple Q&A, summarization        |
| Streaming         | Chat UI, long responses          |
| Structured Output | Data extraction, parsing         |
| Function Calling  | External actions, data retrieval |
| Fallbacks         | Production reliability           |
| Token Management  | Long conversations, cost control |

| Error   | Action                          |
| ------- | ------------------------------- |
| 401     | Check API key configuration     |
| 429     | Use fallback, implement backoff |
| 500+    | Retry with exponential backoff  |
| Timeout | Reduce tokens, increase timeout |
