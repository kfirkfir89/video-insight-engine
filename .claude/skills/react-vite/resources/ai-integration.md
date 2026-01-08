# AI Integration (React)

Vercel AI SDK, streaming UI, chat components, and production AI UI patterns.

---

## Vercel AI SDK Setup

### DO ✅

```tsx
// lib/ai.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Note: API keys should be handled server-side
// These are only for edge/serverless environments
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### DON'T ❌

```tsx
// Never expose API keys in frontend
const openai = createOpenAI({
  apiKey: "sk-...", // NEVER!
});

// Don't use VITE_ prefix for secret keys
import.meta.env.VITE_OPENAI_API_KEY; // This is exposed to browser!
```

---

## useChat Hook

### DO ✅

```tsx
import { useChat } from "ai/react";

function ChatInterface() {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: [],
    id: "unique-chat-id", // For persistence
    onResponse: (response) => {
      // Handle headers, status
      if (!response.ok) {
        console.error("Response error:", response.status);
      }
    },
    onFinish: (message) => {
      // Message complete - save, analytics, etc.
      trackEvent("chat_complete", { length: message.content.length });
    },
    onError: (error) => {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
    },
  });

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onStop={stop}
      />

      {error && <ErrorBanner error={error} onRetry={() => reload()} />}
    </div>
  );
}
```

---

## useCompletion Hook

### DO ✅

```tsx
import { useCompletion } from "ai/react";

function TextGenerator() {
  const {
    completion,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    complete,
    stop,
  } = useCompletion({
    api: "/api/completion",
    onFinish: (prompt, completion) => {
      // Save generated content
      saveToHistory({ prompt, completion });
    },
  });

  // Programmatic completion
  const generateSummary = async (text: string) => {
    await complete(`Summarize this: ${text}`);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your prompt..."
          rows={4}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate"}
        </button>
      </form>

      {completion && (
        <StreamingText content={completion} isStreaming={isLoading} />
      )}
    </div>
  );
}
```

---

## Message Components

### DO ✅

```tsx
import { Message } from "ai";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Smart auto-scroll
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop <=
      container.clientHeight + 100;
    setAutoScroll(isAtBottom);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 && <EmptyState />}

      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}

      {isLoading && <TypingIndicator />}

      <div ref={messagesEndRef} />

      {!autoScroll && (
        <ScrollToBottomButton onClick={() => setAutoScroll(true)} />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isLast,
}: {
  message: Message;
  isLast: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`group relative max-w-[80%] ${isUser ? "order-2" : ""}`}>
        {!isUser && <Avatar className="absolute -left-10 top-0" />}

        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? "bg-blue-600 text-white rounded-br-md"
              : "bg-gray-100 text-gray-900 rounded-bl-md"
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        <MessageActions message={message} isLast={isLast} />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="flex space-x-1 bg-gray-100 rounded-full px-4 py-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Streaming Text Display

### DO ✅

```tsx
interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative prose prose-sm max-w-none">
      <MarkdownContent content={content} />

      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
      )}
    </div>
  );
}

// Smooth character-by-character reveal (optional)
function TypewriterText({ content }: { content: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (content.length <= displayed.length) return;

    const timer = setTimeout(() => {
      setDisplayed(content.slice(0, displayed.length + 1));
    }, 10);

    return () => clearTimeout(timer);
  }, [content, displayed]);

  return <span>{displayed}</span>;
}
```

---

## Markdown Rendering

### DO ✅

```tsx
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const code = String(children).replace(/\n$/, "");

          if (!inline && match) {
            return (
              <div className="relative group">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton code={code} />
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-lg !mt-0"
                  {...props}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code
              className="bg-gray-100 px-1.5 py-0.5 rounded text-sm"
              {...props}
            >
              {children}
            </code>
          );
        },
        // Custom link handling
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {children}
            </a>
          );
        },
        // Tables
        table({ children }) {
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                {children}
              </table>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
    >
      {copied ? (
        <CheckIcon className="w-4 h-4" />
      ) : (
        <CopyIcon className="w-4 h-4" />
      )}
    </button>
  );
}
```

---

## Chat Input Component

### DO ✅

```tsx
interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
}

function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Submit on Enter (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="p-4 border-t bg-white">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isLoading}
            rows={1}
            className="w-full px-4 py-3 pr-12 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />

          <div className="absolute right-2 bottom-2">
            {input.length > 0 && (
              <span className="text-xs text-gray-400">{input.length}/4000</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="p-3 rounded-xl bg-red-100 text-red-600 hover:bg-red-200"
          >
            <StopIcon className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
```

---

## Loading States

### DO ✅

```tsx
function ChatEmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (text: string) => void;
}) {
  const suggestions = [
    "Explain quantum computing in simple terms",
    "Write a poem about programming",
    "Help me debug my React code",
    "What are the best practices for API design?",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
        <SparklesIcon className="w-8 h-8 text-white" />
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        How can I help you today?
      </h2>
      <p className="text-gray-500 mb-8 max-w-md">
        Ask me anything - I can help with writing, analysis, coding, and more.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="p-4 text-left rounded-xl border hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm text-gray-700">{suggestion}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
          <div
            className={`rounded-2xl h-16 ${
              i % 2 === 0 ? "w-48 bg-blue-100" : "w-64 bg-gray-100"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## Regenerate & Edit

### DO ✅

```tsx
function MessageActions({
  message,
  isLast,
}: {
  message: Message;
  isLast: boolean;
}) {
  const { reload, setMessages, messages } = useChat();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const handleRegenerate = () => {
    // Remove this message and regenerate
    reload();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content);
  };

  const handleSaveEdit = () => {
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return;

    // Update message and remove subsequent messages
    const updatedMessages = messages.slice(0, messageIndex);
    updatedMessages.push({ ...message, content: editedContent });

    setMessages(updatedMessages);
    setIsEditing(false);

    // Trigger new response if it was a user message
    if (message.role === "user") {
      // The useChat will automatically continue
    }
  };

  if (isEditing) {
    return (
      <div className="mt-2">
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full p-2 border rounded-lg"
          rows={3}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSaveEdit}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Save & Regenerate
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1 border rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <CopyButton code={message.content} />

      {message.role === "user" && (
        <button onClick={handleEdit} className="p-1 hover:bg-gray-200 rounded">
          <EditIcon className="w-4 h-4" />
        </button>
      )}

      {message.role === "assistant" && isLast && (
        <button
          onClick={handleRegenerate}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
```

---

## Feedback Collection

### DO ✅

```tsx
function MessageFeedback({ messageId }: { messageId: string }) {
  const [feedback, setFeedback] = useState<"positive" | "negative" | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState("");

  const handleFeedback = async (type: "positive" | "negative") => {
    setFeedback(type);

    if (type === "negative") {
      setShowDetails(true);
    } else {
      await submitFeedback({ messageId, type });
    }
  };

  const handleSubmitDetails = async () => {
    await submitFeedback({ messageId, type: feedback!, details });
    setShowDetails(false);
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-gray-500">Was this helpful?</span>

      <button
        onClick={() => handleFeedback("positive")}
        className={`p-1 rounded ${
          feedback === "positive"
            ? "bg-green-100 text-green-600"
            : "hover:bg-gray-100"
        }`}
      >
        <ThumbsUpIcon className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleFeedback("negative")}
        className={`p-1 rounded ${
          feedback === "negative"
            ? "bg-red-100 text-red-600"
            : "hover:bg-gray-100"
        }`}
      >
        <ThumbsDownIcon className="w-4 h-4" />
      </button>

      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="font-medium mb-4">What went wrong?</h3>

            <div className="space-y-2 mb-4">
              {["Inaccurate", "Not helpful", "Offensive", "Other"].map(
                (option) => (
                  <label key={option} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>{option}</span>
                  </label>
                )
              )}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us more (optional)..."
              className="w-full p-3 border rounded-lg mb-4"
              rows={3}
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDetails}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Multi-Modal Display

### DO ✅

```tsx
interface MessageWithAttachments extends Message {
  attachments?: Array<{
    type: "image" | "file";
    url: string;
    name: string;
  }>;
}

function MultiModalMessage({ message }: { message: MessageWithAttachments }) {
  return (
    <div className="space-y-2">
      {/* Text content */}
      {message.content && <MarkdownContent content={message.content} />}

      {/* Attachments */}
      {message.attachments?.map((attachment, i) => (
        <AttachmentPreview key={i} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentPreview({
  attachment,
}: {
  attachment: { type: string; url: string; name: string };
}) {
  if (attachment.type === "image") {
    return (
      <div className="relative group">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-w-sm rounded-lg border cursor-pointer"
          onClick={() => window.open(attachment.url, "_blank")}
        />
        <button className="absolute top-2 right-2 p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100">
          <ExplainIcon className="w-4 h-4 text-white" />
        </button>
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
    >
      <FileIcon className="w-5 h-5 text-gray-500" />
      <span className="text-sm">{attachment.name}</span>
      <DownloadIcon className="w-4 h-4 text-gray-400 ml-auto" />
    </a>
  );
}

// Image upload handling
function ImageUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      onUpload(file);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed rounded-lg p-4 text-center"
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        className="hidden"
        id="image-upload"
      />
      <label htmlFor="image-upload" className="cursor-pointer">
        <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">
          Drop an image or click to upload
        </p>
      </label>
    </div>
  );
}
```

---

## Error Recovery

### DO ✅

```tsx
function ChatErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <AlertCircleIcon className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-medium mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-4 text-center max-w-md">
            {error.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Try again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

function NetworkErrorHandler({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const isNetworkError =
    error.message.includes("fetch") || error.message.includes("network");
  const isRateLimit =
    error.message.includes("429") || error.message.includes("rate");

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <div className="flex items-start gap-3">
        <AlertCircleIcon className="w-5 h-5 text-red-500 mt-0.5" />

        <div className="flex-1">
          <h3 className="font-medium text-red-800">
            {isNetworkError && "Connection Error"}
            {isRateLimit && "Too Many Requests"}
            {!isNetworkError && !isRateLimit && "Error"}
          </h3>

          <p className="text-sm text-red-600 mt-1">
            {isNetworkError &&
              "Please check your internet connection and try again."}
            {isRateLimit &&
              "Please wait a moment before sending another message."}
            {!isNetworkError && !isRateLimit && error.message}
          </p>

          <button
            onClick={onRetry}
            className="mt-3 text-sm text-red-700 font-medium hover:underline"
          >
            {isRateLimit ? "Try again in 30 seconds" : "Retry"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Conversation Persistence

### DO ✅

```tsx
// hooks/useChatPersistence.ts
function useChatPersistence(chatId: string) {
  const { messages, setMessages, isLoading } = useChat({
    id: chatId,
    api: "/api/chat",
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`chat:${chatId}`);
    if (saved && messages.length === 0) {
      setMessages(JSON.parse(saved));
    }
  }, [chatId]);

  // Save to localStorage on change
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      localStorage.setItem(`chat:${chatId}`, JSON.stringify(messages));
    }
  }, [messages, isLoading, chatId]);

  // Clear chat
  const clearChat = () => {
    localStorage.removeItem(`chat:${chatId}`);
    setMessages([]);
  };

  return { messages, setMessages, clearChat };
}
```

---

## Quick Reference

| Hook            | Purpose                                |
| --------------- | -------------------------------------- |
| `useChat`       | Multi-turn conversation with streaming |
| `useCompletion` | Single prompt/completion               |
| `useAssistant`  | OpenAI Assistants API                  |

| State     | UI                               |
| --------- | -------------------------------- |
| Empty     | Welcome message + suggestions    |
| Loading   | Typing indicator, disabled input |
| Streaming | Partial content + cursor         |
| Error     | Error banner + retry button      |
| Complete  | Full message + actions           |

| Feature     | Implementation                                |
| ----------- | --------------------------------------------- |
| Auto-scroll | Track scroll position, pause on manual scroll |
| Copy code   | Button on code blocks                         |
| Regenerate  | Reload last response                          |
| Edit        | Modify user message, resubmit                 |
| Feedback    | Thumbs up/down + details modal                |
