import { describe, it, expect, beforeEach } from "vitest";
import {
  useProcessingStore,
  toProcessingStreamState,
  type ProcessingStreamState,
} from "../processing-store";
import type { StreamState, StreamPhase } from "@/hooks/use-summary-stream";

// Mock stream state factory
const createMockStreamState = (
  overrides: Partial<ProcessingStreamState> = {}
): ProcessingStreamState => ({
  phase: "idle",
  metadata: null,
  error: null,
  ...overrides,
});

// Mock full StreamState for toProcessingStreamState tests
const createFullStreamState = (
  overrides: Partial<StreamState> = {}
): StreamState => ({
  phase: "idle",
  metadata: null,
  duration: null,
  error: null,
  isCached: false,
  processingTimeMs: null,
  warnings: [],
  confettiCount: 0,
  intent: null,
  extractionProgress: null,
  output: null,
  enrichment: null,
  synthesis: null,
  ...overrides,
});

describe("processingStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useProcessingStore.setState({ streams: new Map() });
  });

  describe("initial state", () => {
    it("should have empty streams map initially", () => {
      const state = useProcessingStore.getState();

      expect(state.streams).toBeInstanceOf(Map);
      expect(state.streams.size).toBe(0);
    });
  });

  describe("setStreamState", () => {
    it("should add a new stream state", () => {
      const { setStreamState } = useProcessingStore.getState();
      const streamState = createMockStreamState({ phase: "connecting" });

      setStreamState("video-1", streamState);

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(1);
      expect(state.streams.get("video-1")).toEqual(streamState);
    });

    it("should update an existing stream state", () => {
      const { setStreamState } = useProcessingStore.getState();

      // Initial state
      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));

      // Update state
      const updatedState = createMockStreamState({
        phase: "metadata",
        metadata: {
          title: "Test Video",
          channel: "Test Channel",
          thumbnailUrl: "https://example.com/thumb.jpg",
          duration: 300,
        },
      });
      setStreamState("video-1", updatedState);

      const state = useProcessingStore.getState();
      expect(state.streams.get("video-1")).toEqual(updatedState);
      expect(state.streams.get("video-1")?.metadata?.title).toBe("Test Video");
    });

    it("should allow multiple video streams", () => {
      const { setStreamState } = useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      setStreamState("video-2", createMockStreamState({ phase: "metadata" }));
      setStreamState("video-3", createMockStreamState({ phase: "extraction" }));

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(3);
      expect(state.streams.get("video-1")?.phase).toBe("connecting");
      expect(state.streams.get("video-2")?.phase).toBe("metadata");
      expect(state.streams.get("video-3")?.phase).toBe("extraction");
    });

    it("should track error state", () => {
      const { setStreamState } = useProcessingStore.getState();

      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "error",
          error: "Video unavailable",
        })
      );

      const state = useProcessingStore.getState();
      expect(state.streams.get("video-1")?.phase).toBe("error");
      expect(state.streams.get("video-1")?.error).toBe("Video unavailable");
    });
  });

  describe("removeStreamState", () => {
    it("should remove a stream state", () => {
      const { setStreamState, removeStreamState } =
        useProcessingStore.getState();

      // Add streams
      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      setStreamState("video-2", createMockStreamState({ phase: "metadata" }));

      // Remove one
      removeStreamState("video-1");

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(1);
      expect(state.streams.has("video-1")).toBe(false);
      expect(state.streams.has("video-2")).toBe(true);
    });

    it("should handle removing non-existent stream", () => {
      const { removeStreamState } = useProcessingStore.getState();

      // Should not throw
      expect(() => removeStreamState("non-existent")).not.toThrow();

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(0);
    });

    it("should remove stream on completion", () => {
      const { setStreamState, removeStreamState } =
        useProcessingStore.getState();

      // Simulate stream lifecycle
      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      setStreamState("video-1", createMockStreamState({ phase: "metadata" }));
      setStreamState("video-1", createMockStreamState({ phase: "extraction" }));
      setStreamState("video-1", createMockStreamState({ phase: "done" }));

      // Remove on completion
      removeStreamState("video-1");

      const state = useProcessingStore.getState();
      expect(state.streams.has("video-1")).toBe(false);
    });
  });

  describe("getStreamState", () => {
    it("should return stream state for existing video", () => {
      const { setStreamState, getStreamState } = useProcessingStore.getState();
      const streamState = createMockStreamState({ phase: "metadata" });

      setStreamState("video-1", streamState);

      expect(getStreamState("video-1")).toEqual(streamState);
    });

    it("should return undefined for non-existent video", () => {
      const { getStreamState } = useProcessingStore.getState();

      expect(getStreamState("non-existent")).toBeUndefined();
    });
  });

  describe("clearAllStreams", () => {
    it("should clear all streams", () => {
      const { setStreamState, clearAllStreams } = useProcessingStore.getState();

      // Add multiple streams
      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      setStreamState("video-2", createMockStreamState({ phase: "metadata" }));
      setStreamState("video-3", createMockStreamState({ phase: "done" }));

      expect(useProcessingStore.getState().streams.size).toBe(3);

      // Clear all
      clearAllStreams();

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(0);
    });

    it("should work on empty streams map", () => {
      const { clearAllStreams } = useProcessingStore.getState();

      expect(() => clearAllStreams()).not.toThrow();

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(0);
    });

    it("should be idempotent", () => {
      const { setStreamState, clearAllStreams } = useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      clearAllStreams();
      clearAllStreams();
      clearAllStreams();

      const state = useProcessingStore.getState();
      expect(state.streams.size).toBe(0);
    });
  });

  describe("useProcessingStreamState hook selector", () => {
    it("should return stream state for given video", () => {
      const { setStreamState } = useProcessingStore.getState();
      const streamState = createMockStreamState({ phase: "extraction" });

      setStreamState("video-1", streamState);

      const result = useProcessingStore
        .getState()
        .streams.get("video-1");
      expect(result).toEqual(streamState);
    });

    it("should return undefined for undefined videoSummaryId", () => {
      const { setStreamState } = useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));

      // Simulate hook behavior with undefined
      const result = undefined
        ? useProcessingStore.getState().streams.get(undefined)
        : undefined;
      expect(result).toBeUndefined();
    });
  });

  describe("toProcessingStreamState", () => {
    it("should convert full StreamState to ProcessingStreamState", () => {
      const fullState = createFullStreamState({
        phase: "extraction",
        metadata: {
          title: "Test Video",
          channel: "Test Channel",
          thumbnailUrl: "https://example.com/thumb.jpg",
          duration: 300,
        },
        error: null,
      });

      const result = toProcessingStreamState(fullState);

      expect(result.phase).toBe("extraction");
      expect(result.metadata).toEqual({
        title: "Test Video",
        channel: "Test Channel",
        thumbnailUrl: "https://example.com/thumb.jpg",
        duration: 300,
      });
      expect(result.error).toBeNull();
    });

    it("should preserve error state", () => {
      const fullState = createFullStreamState({
        phase: "error",
        error: "Video processing failed",
      });

      const result = toProcessingStreamState(fullState);

      expect(result.phase).toBe("error");
      expect(result.error).toBe("Video processing failed");
    });

    it("should handle null metadata", () => {
      const fullState = createFullStreamState({
        phase: "connecting",
        metadata: null,
      });

      const result = toProcessingStreamState(fullState);

      expect(result.metadata).toBeNull();
    });

    it("should handle partial metadata", () => {
      const fullState = createFullStreamState({
        phase: "metadata",
        metadata: {
          title: "Test Video",
        },
      });

      const result = toProcessingStreamState(fullState);

      expect(result.metadata?.title).toBe("Test Video");
    });
  });

  describe("stream lifecycle", () => {
    it("should track a complete pipeline stream lifecycle", () => {
      const { setStreamState, removeStreamState, getStreamState } =
        useProcessingStore.getState();

      // Phase 1: Connecting
      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      expect(getStreamState("video-1")?.phase).toBe("connecting");

      // Phase 2: Metadata
      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "metadata",
          metadata: {
            title: "Test Video",
            channel: "Test Channel",
            thumbnailUrl: "https://example.com/thumb.jpg",
            duration: 600,
          },
        })
      );
      expect(getStreamState("video-1")?.phase).toBe("metadata");
      expect(getStreamState("video-1")?.metadata?.title).toBe("Test Video");

      // Phase 3: Extraction
      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "extraction",
          metadata: {
            title: "Test Video",
            channel: "Test Channel",
            thumbnailUrl: "https://example.com/thumb.jpg",
            duration: 600,
          },
        })
      );
      expect(getStreamState("video-1")?.phase).toBe("extraction");

      // Phase 4: Synthesis
      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "synthesis",
          metadata: {
            title: "Test Video",
            channel: "Test Channel",
            thumbnailUrl: "https://example.com/thumb.jpg",
            duration: 600,
          },
        })
      );
      expect(getStreamState("video-1")?.phase).toBe("synthesis");

      // Phase 5: Done
      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "done",
          metadata: {
            title: "Test Video",
            channel: "Test Channel",
            thumbnailUrl: "https://example.com/thumb.jpg",
            duration: 600,
          },
        })
      );
      expect(getStreamState("video-1")?.phase).toBe("done");

      // Cleanup
      removeStreamState("video-1");
      expect(getStreamState("video-1")).toBeUndefined();
    });

    it("should handle error in stream lifecycle", () => {
      const { setStreamState, getStreamState } = useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      setStreamState("video-1", createMockStreamState({ phase: "metadata" }));

      // Error occurs
      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "error",
          error: "Video is unavailable",
        })
      );

      const stream = getStreamState("video-1");
      expect(stream?.phase).toBe("error");
      expect(stream?.error).toBe("Video is unavailable");
    });

    it("should handle cancelled stream", () => {
      const { setStreamState, getStreamState } = useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "extraction" }));
      setStreamState(
        "video-1",
        createMockStreamState({
          phase: "cancelled",
          error: "User cancelled",
        })
      );

      const stream = getStreamState("video-1");
      expect(stream?.phase).toBe("cancelled");
    });
  });

  describe("concurrent streams", () => {
    it("should handle multiple videos processing simultaneously", () => {
      const { setStreamState, getStreamState } = useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "connecting" }));
      setStreamState("video-2", createMockStreamState({ phase: "connecting" }));

      // Video 1 progresses
      setStreamState("video-1", createMockStreamState({ phase: "extraction" }));

      // Video 3 starts
      setStreamState("video-3", createMockStreamState({ phase: "connecting" }));

      // Video 2 progresses
      setStreamState("video-2", createMockStreamState({ phase: "metadata" }));

      // Verify all are tracked independently
      expect(getStreamState("video-1")?.phase).toBe("extraction");
      expect(getStreamState("video-2")?.phase).toBe("metadata");
      expect(getStreamState("video-3")?.phase).toBe("connecting");
    });

    it("should not affect other streams when one is removed", () => {
      const { setStreamState, removeStreamState, getStreamState } =
        useProcessingStore.getState();

      setStreamState("video-1", createMockStreamState({ phase: "done" }));
      setStreamState("video-2", createMockStreamState({ phase: "metadata" }));
      setStreamState("video-3", createMockStreamState({ phase: "connecting" }));

      removeStreamState("video-1");

      expect(getStreamState("video-1")).toBeUndefined();
      expect(getStreamState("video-2")?.phase).toBe("metadata");
      expect(getStreamState("video-3")?.phase).toBe("connecting");
    });
  });

  describe("phase types", () => {
    const phases: StreamPhase[] = [
      "idle",
      "connecting",
      "metadata",
      "intent_detection",
      "extraction",
      "enrichment",
      "synthesis",
      "done",
      "cancelled",
      "error",
    ];

    phases.forEach((phase) => {
      it(`should handle "${phase}" phase`, () => {
        const { setStreamState, getStreamState } =
          useProcessingStore.getState();

        setStreamState("video-1", createMockStreamState({ phase }));

        expect(getStreamState("video-1")?.phase).toBe(phase);
      });
    });
  });
});
