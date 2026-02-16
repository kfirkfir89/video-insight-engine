import { useState, useCallback, useRef } from "react";
import { explainApi } from "@/api/explain";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseVideoChatOptions {
  videoSummaryId: string;
  onError?: (error: Error) => void;
}

interface UseVideoChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (message: string) => void;
  retryLastMessage: () => void;
  clearMessages: () => void;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hook for video-scoped chat. Ephemeral — history lives in React state only.
 * Calls POST /api/explain/video-chat with full chat history each time.
 */
export function useVideoChat({
  videoSummaryId,
  onError,
}: UseVideoChatOptions): UseVideoChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to avoid stale closure over messages in async callback
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const isLoadingRef = useRef(false);
  isLoadingRef.current = isLoading;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoadingRef.current) return;

      setError(null);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
      };

      // Build chat history from ref (always current)
      const chatHistory = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const result = await explainApi.videoChat(
          videoSummaryId,
          content.trim(),
          chatHistory.length > 0 ? chatHistory : undefined
        );

        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: result.response,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Chat failed");
        setError(e);
        onError?.(e);
      } finally {
        setIsLoading(false);
      }
    },
    [videoSummaryId, onError]
  );

  const retryLastMessage = useCallback(() => {
    const currentMsgs = messagesRef.current;
    const lastUserMsg = [...currentMsgs]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove failed message and sync ref before sendMessage reads it
    const withoutFailed = currentMsgs.filter((m) => m.id !== lastUserMsg.id);
    setMessages(withoutFailed);
    messagesRef.current = withoutFailed;
    setError(null);
    sendMessage(lastUserMsg.content);
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, retryLastMessage, clearMessages };
}
