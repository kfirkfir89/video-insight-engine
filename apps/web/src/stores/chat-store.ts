import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatSource {
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
  /** Agent tool steps (e.g. "Created folder \"Series\"") rendered as ✓ lines. */
  steps?: string[];
  isStreaming?: boolean;
  createdAt: string;
}

export type ChatStatus = "idle" | "pending" | "streaming" | "error";

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  setMessages: (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
  setStatus: (status: ChatStatus) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      status: "idle",
      setMessages: (updater) => {
        set((state) => ({
          messages:
            typeof updater === "function" ? updater(state.messages) : updater,
        }));
      },
      setStatus: (status) => {
        set({ status });
      },
      clearMessages: () => {
        set({ messages: [], status: "idle" });
      },
    }),
    {
      name: "vie-chat",
      // Only persist the transcript — status is volatile and a reload should
      // never resurrect a "streaming"/"pending" spinner.
      partialize: (state) => ({ messages: state.messages }),
      // A stream interrupted by navigation or reload leaves a message flagged
      // `isStreaming: true`. Without sanitizing it on load the bubble would show
      // a forever-cursor ▌, so force every rehydrated message to a settled state.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.messages = state.messages.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false } : m,
        );
      },
    },
  ),
);
