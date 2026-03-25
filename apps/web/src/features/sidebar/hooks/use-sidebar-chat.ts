import { useState, useCallback, useEffect, useRef } from "react";
import {
  sendAssistantMessage,
  type AssistantChatMessage,
  type AssistantChatEvent,
} from "@/lib/assistant";

interface ChatSource {
  title: string;
  youtubeId: string;
  timestamp?: string;
  timestampSeconds?: number;
  relevanceScore?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  isStreaming?: boolean;
  createdAt: string;
}

export type ChatStatus = "idle" | "pending" | "streaming" | "error";

interface UseSidebarChatOptions {
  /** When provided, chat messages are sent to this video's assistant endpoint. */
  videoSummaryId?: string;
}

export function useSidebarChat(options: UseSidebarChatOptions = {}) {
  const { videoSummaryId } = options;
  // Track videoSummaryId alongside messages to reset on change.
  // React 19 pattern: derive state from props without effects.
  const [state, setState] = useState({
    videoKey: videoSummaryId,
    messages: [] as ChatMessage[],
    status: "idle" as ChatStatus,
  });

  // If videoSummaryId changed, reset conversation state
  let { messages, status } = state;
  if (state.videoKey !== videoSummaryId) {
    messages = [];
    status = "idle";
    setState({ videoKey: videoSummaryId, messages, status });
  }

  const setMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setState((prev) => ({
        ...prev,
        messages: typeof updater === "function" ? updater(prev.messages) : updater,
      }));
    },
    [],
  );

  const setStatus = useCallback((newStatus: ChatStatus) => {
    setState((prev) => ({ ...prev, status: newStatus }));
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    (message: string) => {
      // Add user message immediately
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // If no videoSummaryId, show a helpful placeholder
      if (!videoSummaryId) {
        const placeholderMsg: ChatMessage = {
          id: `msg-${Date.now()}-reply`,
          role: "assistant",
          content:
            "Open a video to start chatting. The assistant can answer questions about your video content.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, placeholderMsg]);
        return;
      }

      // Build conversation history from current messages (excluding the one we just added)
      const history: AssistantChatMessage[] = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Create a streaming assistant message placeholder
      const assistantId = `msg-${Date.now()}-reply`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStatus("pending");

      // Abort any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const handleEvent = (event: AssistantChatEvent) => {
        if (!mountedRef.current) return;

        switch (event.type) {
          case "text":
            setStatus("streaming");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + (event.content ?? "") }
                  : m,
              ),
            );
            break;

          case "source": {
            const mapped: ChatSource[] = (event.sources ?? []).map((s) => ({
              title: s.text.slice(0, 60),
              youtubeId: "",
              timestamp: s.timestamp ?? undefined,
              relevanceScore: s.score,
            }));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, sources: mapped } : m,
              ),
            );
            break;
          }

          case "error":
            setStatus("error");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        event.content ?? "Something went wrong. Please try again.",
                      isStreaming: false,
                    }
                  : m,
              ),
            );
            break;

          case "done":
            setStatus("idle");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              ),
            );
            break;
        }
      };

      sendAssistantMessage(
        videoSummaryId,
        message,
        history,
        handleEvent,
        controller.signal,
      ).catch((err) => {
        if (!mountedRef.current) return;
        // Ignore abort errors (user navigated away or sent another message)
        if (err instanceof Error && err.name === "AbortError") return;

        setStatus("error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Failed to connect to assistant. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      });
    },
    [videoSummaryId, setMessages, setStatus],
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setStatus("idle");
  }, [setMessages, setStatus]);

  return { messages, status, sendMessage, clearMessages };
}
