# AI Integration (Node.js)

LLM integration using the Vercel AI SDK — provider abstraction, streaming, structured output, and tool calling.

<rules>
- ALWAYS use Vercel AI SDK (`ai` package) for LLM calls — unified interface across OpenAI, Anthropic, Google (causes vendor lock-in and inconsistent error handling if using raw SDKs)
- ALWAYS create singleton provider instances — never instantiate per request (causes unnecessary overhead and connection churn)
- ALWAYS handle stream errors with `onError` callback on `streamText` (causes silent stream failures in production)
- ALWAYS track token usage via `onFinish` callback or `result.usage` (causes unmonitored cost runaway)
- ALWAYS use `generateObject` with Zod schemas for structured output (causes fragile JSON parsing if using string-based extraction)
- NEVER hardcode API keys — use config module (causes credential exposure)
- NEVER create new provider instances per request (causes memory leaks and rate limit issues)
</rules>

---

## Provider Setup

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY });
export const anthropic = createAnthropic({ apiKey: config.ANTHROPIC_API_KEY });

export const models = {
  fast: openai("gpt-4o-mini"),
  smart: openai("gpt-4o"),
  claudeFast: anthropic("claude-sonnet-4-20250514"),
  claudeSmart: anthropic("claude-opus-4-20250514"),
} as const;
```

---

## generateText — Non-Interactive

```typescript
import { generateText } from "ai";

const result = await generateText({
  model: models.fast,
  maxTokens: 1000,
  system: "You are a helpful assistant.",
  prompt,
});
// result.text, result.usage.promptTokens, result.usage.completionTokens
```

---

## streamText — Real-Time SSE

```typescript
import { streamText } from "ai";

const result = streamText({
  model: models.smart,
  messages,
  onError: (error) => {
    logger.error("Stream error", { error });
  },
  onFinish: ({ usage }) => {
    trackUsage(usage).catch(logger.error);
  },
});

// SSE endpoint
reply.raw.writeHead(200, {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
});
for await (const chunk of result.textStream) {
  reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
}
reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
reply.raw.end();
```

---

## Structured Output

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

const result = await generateObject({
  model: models.smart,
  schema,
  prompt: `Extract from:\n\n${text}`,
});
// result.object is typed to schema
```

---

## Tool Calling & Agents

```typescript
import { generateText, tool } from "ai";

const searchTool = tool({
  description: "Search knowledge base",
  parameters: z.object({ query: z.string(), limit: z.number().default(5) }),
  execute: async ({ query, limit }) => knowledgeService.search(query, limit),
});

const result = await generateText({
  model: models.smart,
  prompt: query,
  tools: { search: searchTool },
  maxSteps: 5,
});
// result.steps contains tool calls and results
```

---

## Error Handling & Fallbacks

```typescript
import { APICallError } from "ai";

try {
  return (await generateText({ model: models.smart, prompt })).text;
} catch (error) {
  if (config.fallbackModel) {
    return (await generateText({ model: models[config.fallbackModel], prompt }))
      .text;
  }
  if (error instanceof APICallError) {
    if (error.statusCode === 429)
      throw new AppError("AI rate limit", 429, "AI_RATE_LIMIT");
  }
  throw new AppError("AI service unavailable", 503, "AI_ERROR");
}
```

---

## Edge Cases

- **Stream interruption**: Client disconnects mid-stream. Listen for `request.raw.on('close')` and abort the stream to avoid wasted tokens.
- **Token limit exceeded**: AI SDK throws when prompt exceeds model context. Implement prompt truncation or summarization before calling.
- **Multi-modal input**: Pass images as `{ type: 'image', image: Buffer.from(base64, 'base64') }` in messages content array.

---

## Rules Summary

Use the Vercel AI SDK for all LLM integration — singleton provider instances, model aliases for easy switching. `generateText` for batch/webhook work, `streamText` for real-time with mandatory `onError`/`onFinish` callbacks, `generateObject` with Zod schemas for structured extraction, `tool()` with Zod parameters for tool calling. Always track usage (tokens, cost) via callbacks. Handle failures with provider fallback chains and typed error handling (APICallError status codes). SSE endpoints write directly to `reply.raw` with proper headers.
