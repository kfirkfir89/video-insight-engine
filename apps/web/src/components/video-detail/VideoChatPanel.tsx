import { memo, useState, useCallback, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, User, Bot, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVideoChat, type ChatMessage } from "@/hooks/use-video-chat";

interface VideoChatPanelProps {
  videoSummaryId: string;
  videoTitle: string;
  className?: string;
}

const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </div>
      <div
        className={cn(
          "flex-1 max-w-[85%]",
          isUser && "text-right"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
});

/**
 * Video Chat Panel — ephemeral Q&A grounded in video content.
 * Chat history lives in React state only. No persistence.
 */
export const VideoChatPanel = memo(function VideoChatPanel({
  videoSummaryId,
  videoTitle,
  className,
}: VideoChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, error, sendMessage, retryLastMessage, clearMessages } =
    useVideoChat({ videoSummaryId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;

      sendMessage(trimmed);
      setInput("");
      inputRef.current?.focus();
    },
    [input, isLoading, sendMessage]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium truncate">
            Chat about this video
          </span>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Clear chat history"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground">
            <div className="space-y-2 px-4">
              <MessageCircle className="h-8 w-8 mx-auto opacity-20" aria-hidden="true" />
              <p className="text-sm font-medium">Ask about this video</p>
              <p className="text-xs max-w-[220px] text-muted-foreground/70">
                Questions are answered based on &ldquo;{videoTitle}&rdquo; content.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-destructive text-center">
              {error.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={retryLastMessage}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            >
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this video..."
            disabled={isLoading}
            className="flex-1 h-9 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="h-9 px-3"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
});
