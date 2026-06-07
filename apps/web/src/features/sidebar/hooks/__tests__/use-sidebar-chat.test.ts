import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useSidebarChat } from "../use-sidebar-chat";
import { useChatStore } from "@/stores/chat-store";
import {
  sendAssistantMessage,
  sendLibraryMessage,
  type AssistantChatEvent,
} from "@/lib/assistant";

// Mock the assistant transport so we assert which path the hook dispatches and
// can drive the SSE callback to exercise event handling.
vi.mock("@/lib/assistant", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assistant")>(
    "@/lib/assistant",
  );
  return {
    ...actual,
    sendAssistantMessage: vi.fn(() => Promise.resolve()),
    sendLibraryMessage: vi.fn(() => Promise.resolve()),
  };
});

const mockedSendAssistantMessage = vi.mocked(sendAssistantMessage);
const mockedSendLibraryMessage = vi.mocked(sendLibraryMessage);

// The hook calls useQueryClient(), so every render needs a provider. A fresh
// client per test keeps cache state from bleeding across tests.
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe("useSidebarChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the persisted store between tests so transcripts never leak.
    useChatStore.setState({ messages: [], status: "idle" });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendMessage without videoSummaryId (library mode)", () => {
    it("should call sendLibraryMessage when no video is open", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("What did I learn this week?");
      });

      expect(mockedSendLibraryMessage).toHaveBeenCalledTimes(1);
      expect(mockedSendLibraryMessage).toHaveBeenCalledWith(
        "What did I learn this week?",
        expect.any(Array),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });

    it("should not call the single-video endpoint in library mode", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("hello");
      });

      expect(mockedSendAssistantMessage).not.toHaveBeenCalled();
    });

    it("should not push the placeholder message in library mode", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("hello");
      });

      const placeholder = result.current.messages.find((m) =>
        m.content.includes("Open a video to start chatting"),
      );
      expect(placeholder).toBeUndefined();
    });

    it("should create a streaming assistant message in library mode", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("hello");
      });

      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.isStreaming).toBe(true);
    });
  });

  describe("sendMessage with videoSummaryId (single-video mode)", () => {
    it("should call sendAssistantMessage when a video is open", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useSidebarChat({ videoSummaryId: "vid-123" }),
        { wrapper },
      );

      act(() => {
        result.current.sendMessage("Explain this part");
      });

      expect(mockedSendAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockedSendAssistantMessage).toHaveBeenCalledWith(
        "vid-123",
        "Explain this part",
        expect.any(Array),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });

    it("should not call the library endpoint in single-video mode", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useSidebarChat({ videoSummaryId: "vid-123" }),
        { wrapper },
      );

      act(() => {
        result.current.sendMessage("Explain this part");
      });

      expect(mockedSendLibraryMessage).not.toHaveBeenCalled();
    });

    it("should surface tool steps and refresh the tree on a mutating action while a video is open", () => {
      // Regression: a video being open must NOT make the assistant a toolless
      // chatbot — single-video chat now runs library tools too.
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(
        () => useSidebarChat({ videoSummaryId: "vid-123" }),
        { wrapper },
      );

      act(() => {
        result.current.sendMessage("organize my collection");
      });

      // The single-video transport receives handleEvent as its 4th arg.
      const handleEvent = mockedSendAssistantMessage.mock.calls[0][3] as (
        event: AssistantChatEvent,
      ) => void;

      act(() => {
        handleEvent({
          type: "tool",
          content: "Organized library: 4 folders, 8 videos moved",
          metadata: { status: "done", action: "organize_library" },
        });
        handleEvent({ type: "done" });
      });

      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.steps).toEqual([
        "Organized library: 4 folders, 8 videos moved",
      ]);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["folders", "list"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["videos", "list"],
      });
    });
  });

  describe("sendMessage streams every message through the agent", () => {
    it("should stream an action-like phrase as a normal chat turn", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("organize my library");
      });

      // No client-side intent path anymore — it just chats and the backend
      // agent decides whether to call tools.
      expect(mockedSendLibraryMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("tool events", () => {
    it("should append a step line for a 'tool' done event", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("organize my library");
      });

      // The hook hands handleEvent as the 3rd arg to sendLibraryMessage.
      const handleEvent = mockedSendLibraryMessage.mock.calls[0][2] as (
        event: AssistantChatEvent,
      ) => void;

      act(() => {
        handleEvent({
          type: "tool",
          content: 'Created folder "Series"',
          metadata: { status: "done", action: "create_folder" },
        });
      });

      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.steps).toEqual(['Created folder "Series"']);
    });

    it("should ignore a 'tool' start event (no step until done)", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("organize my library");
      });

      const handleEvent = mockedSendLibraryMessage.mock.calls[0][2] as (
        event: AssistantChatEvent,
      ) => void;

      act(() => {
        handleEvent({
          type: "tool",
          content: "Organizing library…",
          metadata: { status: "start", action: "organize_library" },
        });
      });

      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.steps).toBeUndefined();
    });
  });

  describe("persistence across remount", () => {
    it("should keep messages after the hook unmounts and re-renders", () => {
      const { wrapper } = makeWrapper();
      const first = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        first.result.current.sendMessage("remember me");
      });
      expect(first.result.current.messages.length).toBeGreaterThan(0);

      // Simulate the Sidebar remounting on navigation.
      first.unmount();

      const second = renderHook(() => useSidebarChat(), { wrapper });
      const userMsg = second.result.current.messages.find(
        (m) => m.role === "user",
      );
      expect(userMsg?.content).toBe("remember me");
    });
  });

  describe("live UI refresh on mutating agent actions", () => {
    it("should invalidate folder + video lists after a mutating tool then done", () => {
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("move my videos");
      });

      const handleEvent = mockedSendLibraryMessage.mock.calls[0][2] as (
        event: AssistantChatEvent,
      ) => void;

      act(() => {
        handleEvent({
          type: "tool",
          content: "Moved 3 videos",
          metadata: { status: "done", action: "move_video" },
        });
        handleEvent({ type: "done" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["folders", "list"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["videos", "list"],
      });
    });

    it("should NOT invalidate when no mutating tool ran", () => {
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("what did I learn?");
      });

      const handleEvent = mockedSendLibraryMessage.mock.calls[0][2] as (
        event: AssistantChatEvent,
      ) => void;

      act(() => {
        handleEvent({ type: "text", content: "You learned a lot." });
        handleEvent({ type: "done" });
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("clearMessages", () => {
    it("should empty the transcript", () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSidebarChat(), { wrapper });

      act(() => {
        result.current.sendMessage("hello");
      });
      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearMessages();
      });
      expect(result.current.messages).toEqual([]);
    });
  });
});
