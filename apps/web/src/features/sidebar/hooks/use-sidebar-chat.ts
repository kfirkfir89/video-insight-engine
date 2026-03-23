import { useState, useCallback, useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  createdAt: string;
}

export function useSidebarChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  // Clean up on unmount
  useEffect(() => () => {
    mountedRef.current = false;
    clearTimeout(timeoutRef.current);
  }, []);

  const sendMessage = useCallback((message: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // TODO: Replace with RAG backend integration (explainer MCP chat endpoint)
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-reply`,
        role: 'assistant',
        content: 'Assistant chat is coming soon. This feature will let you ask questions about your saved content.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 500);
  }, []);

  return { messages, sendMessage };
}
