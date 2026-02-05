import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { useSummaryStream, type StreamPhase } from "../use-summary-stream";
import { useAuthStore } from "../../stores/auth-store";

const API_URL = "http://localhost:3000/api";

// Helper to create SSE stream responses
function createSSEResponse(events: Array<{ event: string; data: unknown }>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const { data } of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
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

// Helper to create delayed SSE stream
function createDelayedSSEResponse(
  events: Array<{ event: string; data: unknown }>,
  delayMs = 50
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const { data } of events) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
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

describe("useSummaryStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up auth state with a valid token
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

  describe("SSE connection", () => {
    it("should connect to SSE endpoint when enabled", async () => {
      const events = [
        { event: "phase", data: { event: "phase", phase: "metadata" } },
        {
          event: "metadata",
          data: {
            event: "metadata",
            title: "Test Video",
            channel: "Test Channel",
            duration: 600,
          },
        },
        {
          event: "done",
          data: { event: "done", processingTimeMs: 5000 },
        },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      // Should start connecting
      expect(result.current.phase).toBe("connecting");

      await waitFor(() => {
        expect(result.current.phase).toBe("done");
      });
    });

    it("should not connect when disabled", async () => {
      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: false,
        })
      );

      // Should stay idle
      expect(result.current.phase).toBe("idle");

      // Wait a bit to ensure no connection attempt
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(result.current.phase).toBe("idle");
    });

    it("should not connect without videoSummaryId", async () => {
      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "",
          enabled: true,
        })
      );

      expect(result.current.phase).toBe("idle");
    });

    it("should not connect without access token", async () => {
      useAuthStore.setState({
        accessToken: null,
        isAuthenticated: false,
      });

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      expect(result.current.phase).toBe("idle");
    });
  });

  describe("event parsing", () => {
    it("should parse metadata event", async () => {
      const events = [
        {
          event: "metadata",
          data: {
            event: "metadata",
            title: "Test Video",
            channel: "Test Channel",
            thumbnailUrl: "https://example.com/thumb.jpg",
            duration: 600,
          },
        },
        { event: "done", data: { event: "done", processingTimeMs: 1000 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.metadata?.title).toBe("Test Video");
      });

      expect(result.current.metadata?.channel).toBe("Test Channel");
      expect(result.current.metadata?.thumbnailUrl).toBe(
        "https://example.com/thumb.jpg"
      );
      expect(result.current.duration).toBe(600);
    });

    it("should parse chapter events", async () => {
      const events = [
        { event: "phase", data: { event: "phase", phase: "chapter_summaries" } },
        { event: "chapter_start", data: { event: "chapter_start", index: 0 } },
        {
          event: "chapter_ready",
          data: {
            event: "chapter_ready",
            chapter: {
              id: "s1",
              timestamp: "0:00",
              title: "Introduction",
              startSeconds: 0,
              endSeconds: 60,
              content: [
                { blockId: "b1", type: "paragraph", text: "Summary text" },
                { blockId: "b2", type: "bullets", items: ["Key point 1", "Key point 2"] },
              ],
            },
          },
        },
        { event: "done", data: { event: "done", processingTimeMs: 2000 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.chapters).toHaveLength(1);
      });

      expect(result.current.chapters[0].title).toBe("Introduction");
      expect(result.current.chapters[0].content).toHaveLength(2);
      expect(result.current.chapters[0].content?.[0]).toEqual({
        blockId: "b1",
        type: "paragraph",
        text: "Summary text",
      });
    });

    it("should parse concepts event", async () => {
      const events = [
        {
          event: "concepts_complete",
          data: {
            event: "concepts_complete",
            concepts: [
              {
                id: "c1",
                name: "Test Concept",
                definition: "A concept for testing",
                timestamp: "2:30",
              },
            ],
          },
        },
        { event: "done", data: { event: "done", processingTimeMs: 1000 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.concepts).toHaveLength(1);
      });

      expect(result.current.concepts[0].name).toBe("Test Concept");
    });

    it("should parse synthesis complete event", async () => {
      const events = [
        {
          event: "synthesis_complete",
          data: {
            event: "synthesis_complete",
            tldr: "This is the TL;DR",
            keyTakeaways: ["Point 1", "Point 2"],
          },
        },
        { event: "done", data: { event: "done", processingTimeMs: 3000 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.tldr).toBe("This is the TL;DR");
      });

      expect(result.current.keyTakeaways).toEqual(["Point 1", "Point 2"]);
    });

    it("should handle error events", async () => {
      const events = [
        {
          event: "error",
          data: {
            event: "error",
            message: "Processing failed",
            code: "LLM_ERROR",
          },
        },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.phase).toBe("error");
      });

      // Should show user-friendly error message
      expect(result.current.error).toBeDefined();
    });

    it("should track phase changes", async () => {
      const phases: StreamPhase[] = [];
      const events = [
        { event: "phase", data: { event: "phase", phase: "metadata" } },
        { event: "phase", data: { event: "phase", phase: "transcript" } },
        { event: "phase", data: { event: "phase", phase: "chapter_summaries" } },
        { event: "phase", data: { event: "phase", phase: "synthesis" } },
        { event: "done", data: { event: "done", processingTimeMs: 5000 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () =>
          createDelayedSSEResponse(events, 10)
        )
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      // Track phases during processing
      const checkPhase = setInterval(() => {
        if (
          result.current.phase !== "idle" &&
          result.current.phase !== "connecting"
        ) {
          if (phases[phases.length - 1] !== result.current.phase) {
            phases.push(result.current.phase);
          }
        }
      }, 5);

      await waitFor(
        () => {
          expect(result.current.phase).toBe("done");
        },
        { timeout: 2000 }
      );

      clearInterval(checkPhase);
      expect(phases).toContain("done");
    });
  });

  describe("cleanup on unmount", () => {
    it("should abort connection on unmount", async () => {
      // Create a slow stream that won't complete before unmount
      const events = [
        { event: "phase", data: { event: "phase", phase: "metadata" } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () =>
          createDelayedSSEResponse(events, 1000)
        )
      );

      const { result, unmount } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      // Wait for connection to start
      await waitFor(() => {
        expect(result.current.phase).toBe("connecting");
      });

      // Unmount should not throw
      unmount();
    });
  });

  describe("stop functionality", () => {
    it("should cancel stream when stop is called", async () => {
      const events = [
        { event: "phase", data: { event: "phase", phase: "metadata" } },
        {
          event: "metadata",
          data: { event: "metadata", title: "Test", duration: 600 },
        },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () =>
          createDelayedSSEResponse(events, 500)
        )
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      // Wait for connection
      await waitFor(() => {
        expect(result.current.phase).toBe("connecting");
      });

      // Call stop
      act(() => {
        result.current.stop();
      });

      // Should be cancelled
      expect(result.current.phase).toBe("cancelled");
      expect(result.current.error).toBe("Summarization cancelled by user");
    });
  });

  describe("retry functionality", () => {
    it("should retry connection on retry call", async () => {
      let callCount = 0;

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { message: "Server error" },
              { status: 500 }
            );
          }
          return createSSEResponse([
            { event: "done", data: { event: "done", processingTimeMs: 100 } },
          ]);
        })
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      // Wait for error
      await waitFor(() => {
        expect(result.current.phase).toBe("error");
      });

      // Retry
      act(() => {
        result.current.retry();
      });

      // Should reconnect and succeed
      await waitFor(() => {
        expect(result.current.phase).toBe("done");
      });

      expect(callCount).toBe(2);
    });
  });

  describe("callbacks", () => {
    it("should call onComplete when stream finishes", async () => {
      const onComplete = vi.fn();
      const events = [
        {
          event: "metadata",
          data: { event: "metadata", title: "Test", duration: 300 },
        },
        { event: "done", data: { event: "done", processingTimeMs: 1000 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
          onComplete,
        })
      );

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.any(String),
          metadata: expect.objectContaining({ title: "Test" }),
        })
      );
    });

    it("should call onError when stream errors", async () => {
      const onError = vi.fn();

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => {
          return HttpResponse.json(
            { message: "Internal error" },
            { status: 500 }
          );
        })
      );

      renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
          onError,
        })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe("cached response", () => {
    it("should mark response as cached when cached event received", async () => {
      const events = [
        { event: "cached", data: { event: "cached" } },
        {
          event: "metadata",
          data: { event: "metadata", title: "Cached Video", duration: 300 },
        },
        { event: "done", data: { event: "done", processingTimeMs: 50 } },
      ];

      server.use(
        http.get(`${API_URL}/videos/:id/stream`, () => createSSEResponse(events))
      );

      const { result } = renderHook(() =>
        useSummaryStream({
          videoSummaryId: "video-1",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isCached).toBe(true);
      });
    });
  });
});
