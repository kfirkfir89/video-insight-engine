import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { useExplainerChat } from "../use-streaming-chat";
import { useAuthStore } from "../../stores/auth-store";

const API_URL = "http://localhost:3000/api";

// Helper to create SSE stream for chat responses
function createChatSSEResponse(
  tokens: string[],
  options: { chatId?: string; delay?: number } = {}
) {
  const { chatId = "chat-123", delay = 0 } = options;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send chatId first
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ chatId })}\n\n`)
      );

      // Send tokens
      for (const token of tokens) {
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
        );
      }

      // Send done
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new HttpResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

describe("useExplainerChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up auth state
    useAuthStore.setState({
      accessToken: "test-token",
      isAuthenticated: true,
      user: { id: "user-1", email: "test@test.com", name: "Test" },
    });
  });

  afterEach(() => {
    // Clean up auth state
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
      user: null,
    });
  });

  describe("initial state", () => {
    it("should have empty initial state", () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.input).toBe("");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("input handling", () => {
    it("should update input with setInput", () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("Hello world");
      });

      expect(result.current.input).toBe("Hello world");
    });

    it("should update input with handleInputChange", () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.handleInputChange({
          target: { value: "Test input" },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.input).toBe("Test input");
    });
  });

  describe("message submission", () => {
    it("should add user message on submit", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Hello", " back"])
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      // Set input
      act(() => {
        result.current.setInput("Hello");
      });

      // Submit
      await act(async () => {
        result.current.handleSubmit();
      });

      // Wait for processing
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have user message
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hello");
    });

    it("should clear input after submit", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Response"])
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("Test message");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      // Input should be cleared immediately
      expect(result.current.input).toBe("");
    });

    it("should not submit empty input", async () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      await act(async () => {
        result.current.handleSubmit();
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it("should not submit whitespace-only input", async () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("   ");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it("should not submit while loading", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Slow"], { delay: 500 })
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("First message");
      });

      // Start first submission
      act(() => {
        result.current.handleSubmit();
      });

      // Try to submit again while loading
      act(() => {
        result.current.setInput("Second message");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      // Wait for first to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only have messages from first submission
      expect(result.current.messages).toHaveLength(2);
    });
  });

  describe("streaming", () => {
    it("should stream tokens to assistant message", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Hello", " ", "world", "!"])
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("Hi");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Assistant message should have full streamed content
      const assistantMessage = result.current.messages.find(
        (m) => m.role === "assistant"
      );
      expect(assistantMessage?.content).toBe("Hello world!");
    });

    it("should show loading state during streaming", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Response"], { delay: 100 })
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("Question");
      });

      act(() => {
        result.current.handleSubmit();
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should capture chatId from stream", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Hi"], { chatId: "new-chat-456" })
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("Start conversation");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // chatId is stored internally in the hook
      // We verify it works by making another request
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, async ({ request }) => {
          const body = (await request.json()) as { chatId?: string };
          // Should include chatId from previous response
          expect(body.chatId).toBe("new-chat-456");
          return createChatSSEResponse(["Continued"]);
        })
      );

      act(() => {
        result.current.setInput("Continue");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("error handling", () => {
    it("should handle HTTP errors", async () => {
      const onError = vi.fn();

      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          HttpResponse.json({ message: "Bad request" }, { status: 400 })
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({
          memorizedItemId: "item-1",
          onError,
        })
      );

      act(() => {
        result.current.setInput("Test");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(onError).toHaveBeenCalled();
      // Should remove empty assistant message on error
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("user");
    });

    it("should handle network errors", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          HttpResponse.error()
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.setInput("Test");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("callbacks", () => {
    it("should call onFinish when stream completes", async () => {
      const onFinish = vi.fn();

      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["Complete", " response"])
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({
          memorizedItemId: "item-1",
          onFinish,
        })
      );

      act(() => {
        result.current.setInput("Question");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(onFinish).toHaveBeenCalled();
      });

      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "assistant",
          content: "Complete response",
        })
      );
    });
  });

  describe("message management", () => {
    it("should support append method", () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      act(() => {
        result.current.append({
          role: "assistant",
          content: "Pre-loaded message",
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe("Pre-loaded message");
      expect(result.current.messages[0].id).toBeDefined();
    });

    it("should support setMessages method", () => {
      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      const messages = [
        { id: "msg-1", role: "user" as const, content: "Hello" },
        { id: "msg-2", role: "assistant" as const, content: "Hi there" },
      ];

      act(() => {
        result.current.setMessages(messages);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages).toEqual(messages);
    });
  });

  describe("form submission", () => {
    it("should prevent default form submission", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, () =>
          createChatSSEResponse(["OK"])
        )
      );

      const { result } = renderHook(() =>
        useExplainerChat({ memorizedItemId: "item-1" })
      );

      const preventDefault = vi.fn();

      act(() => {
        result.current.setInput("Test");
      });

      await act(async () => {
        result.current.handleSubmit({
          preventDefault,
        } as unknown as React.FormEvent);
      });

      expect(preventDefault).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("initial chat ID", () => {
    it("should use initial chatId if provided", async () => {
      server.use(
        http.post(`${API_URL}/explain/chat/stream`, async ({ request }) => {
          const body = (await request.json()) as { chatId?: string };
          expect(body.chatId).toBe("existing-chat-id");
          return createChatSSEResponse(["Response"]);
        })
      );

      const { result } = renderHook(() =>
        useExplainerChat({
          memorizedItemId: "item-1",
          chatId: "existing-chat-id",
        })
      );

      act(() => {
        result.current.setInput("Continue chat");
      });

      await act(async () => {
        result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
