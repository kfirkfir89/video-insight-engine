import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, User, Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollContainer } from '@/components/ui/scroll-container';
import { RAGSourceCard } from './RAGSourceCard';

interface RAGSource {
  title: string;
  youtubeId: string;
  thumbnailUrl?: string;
  timestamp?: string;
  timestampSeconds?: number;
  relevanceScore?: number;
}

interface RAGMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGSource[];
  isStreaming?: boolean;
  createdAt: string;
}

type ChatStatus = 'idle' | 'pending' | 'streaming' | 'error';

interface RAGChatPanelProps {
  messages: RAGMessage[];
  /** @deprecated Use `status` instead */
  isLoading?: boolean;
  status?: ChatStatus;
  onSendMessage: (message: string) => void;
  onSeek?: (seconds: number) => void;
  placeholder?: string;
  className?: string;
}

const MessageBubble = memo(function MessageBubble({
  message,
  onSeek,
}: {
  message: RAGMessage;
  onSeek?: (seconds: number) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Bot className="h-4 w-4" aria-hidden="true" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 max-w-[85%] space-y-2',
          isUser && 'text-right'
        )}
      >
        <div
          className={cn(
            'inline-block rounded-lg px-3 py-2 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          {message.content}
          {message.isStreaming && (
            <span className="inline-block ml-1 animate-pulse">▌</span>
          )}
        </div>

        {/* Sources (assistant only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>Sources</span>
            </div>
            <div className="space-y-1">
              {message.sources.map((source, i) => (
                <RAGSourceCard
                  key={i}
                  {...source}
                  onSeek={onSeek}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * RAG Chat Panel for conversational Q&A over memorized content.
 * Supports streaming responses and source attribution.
 */
export const RAGChatPanel = memo(function RAGChatPanel({
  messages,
  isLoading,
  status: statusProp,
  onSendMessage,
  onSeek,
  placeholder = 'Ask a question about your saved content...',
  className,
}: RAGChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  // Derive status from prop or backward-compatible isLoading
  const status: ChatStatus = statusProp ?? (isLoading ? 'pending' : 'idle');
  const isBusy = status === 'pending' || status === 'streaming';

  // Smart auto-scroll: only scroll if user hasn't scrolled up
  const scrollToBottom = useCallback(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Detect manual scroll-up via the forwarded scroll container ref
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledUpRef.current = !atBottom;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;

    onSendMessage(trimmed);
    setInput('');
    userScrolledUpRef.current = false;

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    textareaRef.current?.focus();
  }, [input, isBusy, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter → natural newline (default behavior)
  }, [handleSubmit]);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  }, [handleSubmit]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-medium">Chat with your knowledge</h3>
      </div>

      {/* Messages with aria-live for screen readers */}
      <ScrollContainer wrapperClassName="flex-1 min-h-0" className="p-4 space-y-4" ref={scrollContainerRef}>
        <div aria-live="polite" aria-relevant="additions">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground">
              <div className="space-y-2">
                <Sparkles className="h-10 w-10 mx-auto opacity-30" aria-hidden="true" />
                <p className="text-sm">Start a conversation</p>
                <p className="text-xs max-w-[200px]">
                  Ask questions about your memorized videos and saved content.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onSeek={onSeek}
              />
            ))
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollContainer>

      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={handleFormSubmit} className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            aria-label={placeholder}
            placeholder={placeholder}
            disabled={isBusy}
            rows={1}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button type="submit" disabled={!input.trim() || isBusy}>
            {isBusy ? (
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
