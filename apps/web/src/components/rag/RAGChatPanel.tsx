import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, User, Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollContainer } from '@/components/ui/scroll-container';
import { ContentBlockRenderer } from '@/components/video-detail/ContentBlockRenderer';
import { RAGSourceCard } from './RAGSourceCard';
import type { ContentBlock } from '@vie/types';

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
  blocks?: ContentBlock[];
  sources?: RAGSource[];
  isStreaming?: boolean;
  createdAt: string;
}

interface RAGChatPanelProps {
  messages: RAGMessage[];
  isLoading?: boolean;
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

        {/* Content Blocks (assistant only) */}
        {!isUser && message.blocks && message.blocks.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.blocks.map((block, i) => (
              <ContentBlockRenderer key={block.blockId ?? i} block={block} onPlay={onSeek} />
            ))}
          </div>
        )}

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
  onSendMessage,
  onSeek,
  placeholder = 'Ask a question about your saved content...',
  className,
}: RAGChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    onSendMessage(trimmed);
    setInput('');
    inputRef.current?.focus();
  }, [input, isLoading, onSendMessage]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-medium">Chat with your knowledge</h3>
      </div>

      {/* Messages */}
      <ScrollContainer wrapperClassName="flex-1 min-h-0" className="p-4 space-y-4">
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
        <div ref={messagesEndRef} />
      </ScrollContainer>

      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
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
