/**
 * Streaming chat hook for explainer chat.
 *
 * Uses Server-Sent Events (SSE) for real-time character-by-character streaming.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { refreshToken } from "@/api/client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseExplainerChatOptions {
  memorizedItemId: string;
  chatId?: string | null;
  onError?: (error: Error) => void;
  onFinish?: (message: Message) => void;
}

interface UseExplainerChatReturn {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  error: Error | null;
  append: (message: Omit<Message, "id">) => void;
  setMessages: (messages: Message[]) => void;
}

/**
 * Hook for streaming explainer chat responses.
 *
 * @example
 * ```tsx
 * const { messages, input, handleInputChange, handleSubmit, isLoading } = useExplainerChat({
 *   memorizedItemId: "abc123",
 *   onFinish: (message) => console.log("Done:", message),
 * });
 * ```
 */
export function useExplainerChat({
  memorizedItemId,
  chatId: initialChatId,
  onError,
  onFinish,
}: UseExplainerChatOptions): UseExplainerChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const chatIdRef = useRef<string | null>(initialChatId ?? null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  // Issue #3: Ref to store handleSubmit for auto-retry after token refresh
  const pendingRetryRef = useRef<string | null>(null);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const append = useCallback((message: Omit<Message, "id">) => {
    const newMessage: Message = {
      id: generateId(),
      ...message,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input.trim() || isLoading) return;

      const userMessage = input.trim();
      setInput("");
      setError(null);

      // Add user message
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: userMessage,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Create assistant message placeholder
      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${API_URL}/explain/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            memorizedItemId,
            message: userMessage,
            chatId: chatIdRef.current,
          }),
          signal: abortControllerRef.current.signal,
        });

        // Handle 401 - try token refresh once
        // Issue #3: Fixed race condition - auto-retry after successful token refresh
        if (response.status === 401) {
          const refreshed = await refreshToken();
          if (refreshed) {
            // Remove both messages for clean retry
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id && m.id !== userMsg.id));
            setIsLoading(false);
            // Store message for retry and trigger re-submit via effect
            pendingRetryRef.current = userMessage;
            setInput(userMessage);
            return;
          }
          // Refresh failed - force logout and redirect to login
          useAuthStore.getState().forceLogout("Session expired. Please log in again.");
          throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              if (data === "[DONE]") {
                // Stream complete
                const finalMessage: Message = {
                  id: assistantMsg.id,
                  role: "assistant",
                  content: fullContent,
                };
                onFinish?.(finalMessage);
                continue;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.token) {
                  fullContent += parsed.token;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: fullContent } : m
                    )
                  );
                }

                if (parsed.chatId) {
                  chatIdRef.current = parsed.chatId;
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled, not an error
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);

        // Remove empty assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, memorizedItemId, accessToken, onError, onFinish]
  );

  // Issue #3: Auto-retry effect after token refresh
  // When pendingRetryRef is set and input matches, auto-submit
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (pendingRetryRef.current && input === pendingRetryRef.current && !isLoading) {
      pendingRetryRef.current = null;
      // Use setTimeout to avoid state update during render
      setTimeout(() => handleSubmitRef.current(), 0);
    }
  }, [input, isLoading]);

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    append,
    setMessages,
  };
}
