# AI Integration (Node.js)

Core patterns for calling LLMs using the **Vercel AI SDK** - the modern standard for AI integration in Node.js.

---

## Why Vercel AI SDK?

The AI SDK provides a unified interface across providers with built-in:
- **Provider abstraction** - Switch between OpenAI, Anthropic, Google with one line
- **Streaming with callbacks** - `onError`, `onFinish` for production-ready handling
- **Tool calling** - First-class support with type safety
- **Usage tracking** - Automatic token/cost metadata
- **Edge-ready** - Optimized for serverless and edge runtimes

---

## Installation

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

---

## Provider Setup

### DO ✅

```typescript
// lib/ai/providers.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "../config.js";

// Create provider instances (singleton pattern)
export const openai = createOpenAI({
  apiKey: config.OPENAI_API_KEY,
});

export const anthropic = createAnthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

export const google = createGoogleGenerativeAI({
  apiKey: config.GOOGLE_AI_API_KEY,
});

// Model aliases for easy switching
export const models = {
  // Primary models
  fast: openai("gpt-4o-mini"),
  smart: openai("gpt-4o"),
  reasoning: openai("o1"),

  // Claude models
  claudeFast: anthropic("claude-sonnet-4-20250514"),
  claudeSmart: anthropic("claude-opus-4-20250514"),

  // Gemini models
  gemini: google("gemini-2.0-flash"),
  geminiPro: google("gemini-2.0-pro"),
} as const;
```

### DON'T ❌

```typescript
// New client per request (wasteful)
app.post("/chat", async (req) => {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
});

// Hardcoded keys
const openai = createOpenAI({ apiKey: "sk-..." });
```

---

## generateText - Non-Interactive Completions

Use `generateText` for batch operations, webhooks, and background jobs where streaming isn't needed.

### DO ✅

```typescript
// services/ai.service.ts
import { generateText } from "ai";
import { models } from "../lib/ai/providers.js";

interface CompletionOptions {
  model?: keyof typeof models;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const {
    model = "fast",
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt = "You are a helpful assistant.",
  } = options;

  const result = await generateText({
    model: models[model],
    maxTokens,
    temperature,
    system: systemPrompt,
    prompt,
  });

  return {
    text: result.text,
    usage: {
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
    },
  };
}

// With messages array
export async function chat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: CompletionOptions = {}
): Promise<string> {
  const result = await generateText({
    model: models[options.model ?? "smart"],
    maxTokens: options.maxTokens ?? 1000,
    system: options.systemPrompt,
    messages,
  });

  return result.text;
}
```

---

## streamText - Real-Time Streaming

Use `streamText` for chat interfaces and real-time responses. **Critical:** Always use `onError` callback.

### DO ✅

```typescript
// services/ai.service.ts
import { streamText, StreamTextResult } from "ai";
import { models } from "../lib/ai/providers.js";

interface StreamOptions {
  model?: keyof typeof models;
  maxTokens?: number;
  systemPrompt?: string;
  onError?: (error: Error) => void;
  onFinish?: (result: { usage: { promptTokens: number; completionTokens: number } }) => void;
}

export function streamCompletion(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: StreamOptions = {}
): StreamTextResult<Record<string, never>> {
  return streamText({
    model: models[options.model ?? "smart"],
    maxTokens: options.maxTokens ?? 1000,
    system: options.systemPrompt,
    messages,

    // CRITICAL: Always handle errors in production
    onError: options.onError ?? ((error) => {
      logger.error("Stream error", { error });
    }),

    // Track usage after stream completes
    onFinish: options.onFinish ?? (({ usage }) => {
      logger.info("Stream completed", { usage });
    }),
  });
}
```

---

## SSE Endpoint (Fastify)

### DO ✅

```typescript
// routes/chat.routes.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { streamCompletion } from "../services/ai.service.js";

interface ChatBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
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

  const result = streamCompletion(messages, {
    model: model as keyof typeof models,

    onError: (error) => {
      reply.raw.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      reply.raw.end();
    },

    onFinish: ({ usage }) => {
      // Track usage asynchronously
      trackUsage({
        model: model ?? "smart",
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        userId: request.user?.id,
      }).catch(logger.error);
    },
  });

  // Stream chunks to client
  for await (const chunk of result.textStream) {
    reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
  }

  reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  reply.raw.end();
}

// Alternative: Use AI SDK's toTextStreamResponse for simpler cases
export async function streamChatSimple(
  request: FastifyRequest<{ Body: ChatBody }>,
  reply: FastifyReply
): Promise<Response> {
  const result = streamCompletion(request.body.messages);

  // Returns a standard Response object for edge runtimes
  return result.toTextStreamResponse();
}
```

---

## Structured Output (JSON Mode)

### DO ✅

```typescript
import { generateObject } from "ai";
import { z } from "zod";
import { models } from "../lib/ai/providers.js";

// Define schema with Zod
const ExtractedDataSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1),
});

type ExtractedData = z.infer<typeof ExtractedDataSchema>;

export async function extractStructured(text: string): Promise<ExtractedData> {
  const result = await generateObject({
    model: models.smart,
    schema: ExtractedDataSchema,
    prompt: `Extract structured data from this text:\n\n${text}`,
  });

  return result.object;
}

// With streaming for large objects
import { streamObject } from "ai";

export async function* streamExtraction(text: string): AsyncGenerator<Partial<ExtractedData>> {
  const result = streamObject({
    model: models.smart,
    schema: ExtractedDataSchema,
    prompt: `Extract structured data from this text:\n\n${text}`,
  });

  for await (const partialObject of result.partialObjectStream) {
    yield partialObject;
  }
}
```

---

## Tool Calling

### DO ✅

```typescript
import { generateText, tool } from "ai";
import { z } from "zod";
import { models } from "../lib/ai/providers.js";

// Define tools with Zod schemas
const searchTool = tool({
  description: "Search the knowledge base for relevant information",
  parameters: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(5).describe("Max results to return"),
  }),
  execute: async ({ query, limit }) => {
    const results = await knowledgeService.search(query, limit);
    return results;
  },
});

const weatherTool = tool({
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
    unit: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
  }),
  execute: async ({ location, unit }) => {
    return await weatherService.get(location, unit);
  },
});

// Use tools in completion
export async function chatWithTools(prompt: string): Promise<string> {
  const result = await generateText({
    model: models.smart,
    prompt,
    tools: {
      search: searchTool,
      weather: weatherTool,
    },
    maxSteps: 5, // Allow up to 5 tool calls
  });

  return result.text;
}

// Access tool call details
export async function chatWithToolDetails(prompt: string) {
  const result = await generateText({
    model: models.smart,
    prompt,
    tools: { search: searchTool },
    maxSteps: 5,
  });

  return {
    text: result.text,
    toolCalls: result.steps.flatMap((step) => step.toolCalls),
    toolResults: result.steps.flatMap((step) => step.toolResults),
  };
}
```

---

## Agent Loop with stopWhen

For complex agents that need custom stopping conditions:

### DO ✅

```typescript
import { generateText, tool } from "ai";
import { z } from "zod";
import { models } from "../lib/ai/providers.js";

const finishTool = tool({
  description: "Call this when you have the final answer",
  parameters: z.object({
    answer: z.string().describe("The final answer to return"),
    confidence: z.number().min(0).max(1).describe("Confidence in the answer"),
  }),
  // No execute - this is a "signal" tool
});

export async function runAgent(query: string): Promise<{
  answer: string;
  steps: number;
  totalTokens: number;
}> {
  const result = await generateText({
    model: models.smart,
    system: `You are a helpful assistant. Use tools to find information.
When you have the final answer, call the 'finish' tool.`,
    prompt: query,
    tools: {
      search: searchTool,
      calculate: calculateTool,
      finish: finishTool,
    },
    maxSteps: 10,

    // Stop when finish tool is called
    stopWhen: (result) => {
      const lastStep = result.steps.at(-1);
      return lastStep?.toolCalls.some((tc) => tc.toolName === "finish") ?? false;
    },
  });

  // Extract answer from finish tool call
  const finishCall = result.steps
    .flatMap((s) => s.toolCalls)
    .find((tc) => tc.toolName === "finish");

  return {
    answer: finishCall?.args.answer ?? result.text,
    steps: result.steps.length,
    totalTokens: result.usage.totalTokens,
  };
}
```

---

## Error Handling & Fallbacks

### DO ✅

```typescript
import { generateText, APICallError } from "ai";
import { models, openai, anthropic } from "../lib/ai/providers.js";

interface FallbackConfig {
  primary: keyof typeof models;
  fallback?: keyof typeof models;
}

const defaultConfig: FallbackConfig = {
  primary: "smart",
  fallback: "claudeSmart",
};

export async function safeComplete(
  prompt: string,
  config: FallbackConfig = defaultConfig
): Promise<string> {
  try {
    const result = await generateText({
      model: models[config.primary],
      prompt,
    });
    return result.text;
  } catch (error) {
    logger.warn("Primary AI failed, trying fallback", { error, config });

    if (config.fallback) {
      try {
        const fallbackResult = await generateText({
          model: models[config.fallback],
          prompt,
        });
        return fallbackResult.text;
      } catch (fallbackError) {
        logger.error("Fallback AI also failed", { error: fallbackError });
      }
    }

    // Handle specific error types
    if (error instanceof APICallError) {
      if (error.statusCode === 429) {
        throw new AppError("AI rate limit exceeded", 429, "AI_RATE_LIMIT");
      }
      if (error.statusCode === 401) {
        throw new AppError("AI authentication failed", 500, "AI_AUTH_ERROR");
      }
    }

    throw new AppError("AI service unavailable", 503, "AI_ERROR");
  }
}
```

---

## Cost Tracking

The AI SDK provides usage metadata automatically:

### DO ✅

```typescript
import { generateText, streamText } from "ai";
import { models } from "../lib/ai/providers.js";

// Pricing per 1M tokens (update as needed)
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
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

// Wrapper that tracks usage automatically
export async function completionWithTracking(
  prompt: string,
  options: { model?: keyof typeof models; userId?: string; requestId?: string } = {}
): Promise<{ text: string; usage: UsageRecord }> {
  const modelKey = options.model ?? "smart";

  const result = await generateText({
    model: models[modelKey],
    prompt,
  });

  // AI SDK provides usage automatically
  const usage: UsageRecord = {
    model: modelKey,
    inputTokens: result.usage.promptTokens,
    outputTokens: result.usage.completionTokens,
    cost: calculateCost(
      modelKey,
      result.usage.promptTokens,
      result.usage.completionTokens
    ),
    timestamp: new Date(),
    userId: options.userId,
    requestId: options.requestId,
  };

  // Track asynchronously
  trackUsage(usage).catch(logger.error);

  return { text: result.text, usage };
}

// Streaming with usage tracking via onFinish
export function streamWithTracking(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: { model?: keyof typeof models; userId?: string } = {}
) {
  const modelKey = options.model ?? "smart";

  return streamText({
    model: models[modelKey],
    messages,

    onFinish: async ({ usage }) => {
      await trackUsage({
        model: modelKey,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        cost: calculateCost(modelKey, usage.promptTokens, usage.completionTokens),
        timestamp: new Date(),
        userId: options.userId,
      });
    },
  });
}
```

---

## Multi-Modal (Images)

### DO ✅

```typescript
import { generateText } from "ai";
import { models } from "../lib/ai/providers.js";

interface ImageInput {
  type: "url" | "base64";
  data: string;
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export async function analyzeImage(
  image: ImageInput,
  prompt: string
): Promise<string> {
  const imageContent =
    image.type === "url"
      ? { type: "image" as const, image: new URL(image.data) }
      : {
          type: "image" as const,
          image: Buffer.from(image.data, "base64"),
          mimeType: image.mediaType ?? "image/jpeg",
        };

  const result = await generateText({
    model: models.smart, // Use a vision-capable model
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, imageContent],
      },
    ],
  });

  return result.text;
}

// Multiple images
export async function compareImages(
  images: ImageInput[],
  prompt: string
): Promise<string> {
  const imageContents = images.map((img) =>
    img.type === "url"
      ? { type: "image" as const, image: new URL(img.data) }
      : {
          type: "image" as const,
          image: Buffer.from(img.data, "base64"),
          mimeType: img.mediaType ?? "image/jpeg",
        }
  );

  const result = await generateText({
    model: models.smart,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...imageContents],
      },
    ],
  });

  return result.text;
}
```

---

## Quick Reference

| Function         | When to Use                              |
| ---------------- | ---------------------------------------- |
| `generateText`   | Batch jobs, webhooks, non-interactive    |
| `streamText`     | Chat UI, real-time responses             |
| `generateObject` | Structured data extraction, JSON output  |
| `streamObject`   | Large structured responses with progress |

| Callback    | Purpose                                  |
| ----------- | ---------------------------------------- |
| `onError`   | Handle stream errors (CRITICAL)          |
| `onFinish`  | Track usage, log completion              |
| `onChunk`   | Process individual chunks                |

| Error Type      | Action                          |
| --------------- | ------------------------------- |
| 401             | Check API key configuration     |
| 429             | Use fallback, implement backoff |
| 500+            | Retry with exponential backoff  |
| `APICallError`  | Check statusCode for specifics  |

---

## Migration from Raw SDKs

If migrating from raw OpenAI/Anthropic SDK:

```typescript
// Before (raw SDK)
import OpenAI from "openai";
const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: prompt }],
});
const text = response.choices[0]?.message?.content ?? "";

// After (AI SDK)
import { generateText } from "ai";
import { openai } from "./providers.js";
const result = await generateText({
  model: openai("gpt-4o"),
  prompt,
});
const text = result.text;
```
