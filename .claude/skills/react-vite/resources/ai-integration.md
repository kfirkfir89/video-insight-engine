# AI Integration (React)

Vercel AI SDK 6, streaming UI, chat components, and production AI patterns.

<rules>
- ALWAYS import from `@ai-sdk/react` — never from `ai/react` (old path removed in SDK 6, causes module not found)
- ALWAYS use `UIMessage` type — never `Message` from old SDK (causes type errors with SDK 6)
- ALWAYS derive loading state from `status` — `const isLoading = status === "pending" || status === "streaming"` (the `isLoading` property was removed)
- ALWAYS handle all status states: idle, pending, streaming, complete, error (causes missing UI states)
- ALWAYS implement auto-scroll with manual-scroll detection — pause auto-scroll when user scrolls up (causes jarring UX if always forced)
- NEVER expose API keys in frontend code or VITE_ env vars — keys must stay server-side (causes credential exposure)
- NEVER store streaming messages in separate local state — use the messages array from useChat directly (causes stale data and sync bugs)
</rules>

---

## Package Overview

| Package | Purpose |
|---------|---------|
| `@ai-sdk/react` | React hooks (useChat, useCompletion) |
| `ai` | Core streaming utilities, transports |

---

## useChat Hook

Primary hook for multi-turn conversations with streaming.

```tsx
const {
  messages,      // UIMessage[]
  input, setInput,
  handleSubmit,
  status,        // 'idle' | 'pending' | 'streaming' | 'complete' | 'error'
  error, reload, stop, append, setMessages,
} = useChat({
  api: "/api/chat",
  id: "unique-chat-id",
  onError: (error) => toast.error("Failed to send message"),
});

const isLoading = status === "pending" || status === "streaming";
const isStreaming = status === "streaming";
```

---

## Status-Driven UI

| Status | UI State |
|--------|----------|
| `idle` | Ready for input, show suggestions if empty |
| `pending` | Typing indicator, disabled input |
| `streaming` | Partial content + cursor animation |
| `error` | Error banner + retry button via `reload()` |
| `complete` | Full message + copy/regenerate actions |

---

## Transport API

For custom headers, credentials, or connection control:

```tsx
import { DefaultChatTransport } from "ai";

const { messages, status } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    headers: { "X-Custom-Header": "value" },
    credentials: "include",
  }),
});
```

---

## Zustand Integration

For complex apps, sync chat state to Zustand after completion:

```tsx
const { messages, handleSubmit } = useChat({
  id: chatId,
  initialMessages: chats[chatId] || [],
  onFinish: (message) => setMessages(chatId, [...messages, message]),
});
```

---

## Chat Input Pattern

ALWAYS: auto-resize textarea, Enter to submit (Shift+Enter for newline), character limit display, stop button during streaming.

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!isLoading && input.trim()) onSubmit(e);
  }
};
```

---

## Streaming Text Display

ALWAYS show a cursor animation during streaming. Use ReactMarkdown + remarkGfm for assistant messages. Add copy buttons on code blocks.

---

## Message Actions

- **Copy:** clipboard API on message content
- **Regenerate:** `reload()` on last assistant message
- **Edit user message:** slice messages to edit point, update content, resubmit

---

## Error Recovery

Distinguish network errors, rate limits (429), and generic errors. Show contextual messages and retry affordances.

---

## Edge Cases

- **Multiple chat sessions:** Use unique `id` per chat and store messages per-chat in Zustand. Initialize useChat with `initialMessages` from the store.
- **Persistence:** Save to localStorage on `onFinish`, load on mount. Clear with `setMessages([])`.
- **useCompletion vs useChat:** Use `useCompletion` for single-prompt interactions (summarize, generate). Use `useChat` for multi-turn conversations.

---

## Rules Summary

All AI SDK imports come from `@ai-sdk/react`, never `ai/react`. The `UIMessage` type replaces `Message`, and `status` replaces `isLoading`. Every status (idle, pending, streaming, complete, error) maps to a distinct UI state. Chat input supports Enter-to-submit, auto-resize, and stop-on-stream. Messages render with markdown, code highlighting, and copy buttons. API keys never appear in frontend code. Streaming messages come from useChat's messages array directly — never copied to local state.
