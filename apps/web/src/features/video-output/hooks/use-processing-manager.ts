/**
 * Processing Manager Hook
 *
 * App-level hook that automatically manages SSE streams for all processing videos.
 * Enables auto-resume after browser refresh and sidebar sync without user interaction.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useProcessingStore } from "@/features/video-output/stores/processing-store";
import { useAllVideos } from "@/hooks/use-videos";
import { queryKeys } from "@/lib/query-keys";
import { sseLogger } from "@/features/video-output/lib/streaming/sse-logger";
import {
  validatePhaseEvent,
  validateMetadataEvent,
  validateErrorEvent,
} from "@/features/video-output/lib/streaming/sse-validators";
import type { StreamPhase } from "@/features/video-output/hooks/use-summary-stream";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface StreamController {
  abort: () => void;
  videoSummaryId: string;
}

/** Lightweight state tracked by processing manager */
interface ManagerState {
  phase: StreamPhase;
  metadata: {
    title?: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null;
  error?: string | null;
}

// ─── Event processor (lightweight, only tracks phase/metadata/error) ───

function processManagerEvent(
  event: Record<string, unknown>,
  state: Partial<ManagerState>
): Partial<ManagerState> {
  const eventType = typeof event.event === 'string' ? event.event : null;
  if (!eventType) return state;

  switch (eventType) {
    case "phase": {
      const phase = validatePhaseEvent(event);
      return phase ? { ...state, phase: phase as StreamPhase } : state;
    }

    case "metadata": {
      const metadata = validateMetadataEvent(event);
      return {
        ...state,
        phase: "metadata",
        metadata: {
          title: metadata.title,
          channel: metadata.channel,
          thumbnailUrl: metadata.thumbnailUrl,
          duration: metadata.duration,
        },
      };
    }

    case "done":
      return { ...state, phase: "done" };

    case "error": {
      const { message } = validateErrorEvent(event);
      return { ...state, phase: "error", error: message };
    }

    default:
      return state;
  }
}

// ─── SSE reader (extracted from startStream for clarity) ───

async function readManagerSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  videoSummaryId: string,
  setStreamState: (id: string, state: { phase: StreamPhase; metadata: ManagerState['metadata']; error: string | null }) => void,
  onDone: () => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentState: Partial<ManagerState> = {
    phase: "connecting" as StreamPhase,
    metadata: null,
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const event = JSON.parse(data);
        currentState = processManagerEvent(event, currentState);

        setStreamState(videoSummaryId, {
          phase: currentState.phase as StreamPhase,
          metadata: currentState.metadata || null,
          error: currentState.error || null,
        });

        if (event.event === "done") {
          onDone();
        }
      } catch (err) {
        sseLogger.warn('Failed to parse SSE event:', err instanceof Error ? err.message : String(err));
      }
    }
  }
}

// ─── Hook ───

/**
 * Manages all processing video streams at the app level.
 *
 * - Watches video list for status === "pending" | "processing"
 * - Auto-starts SSE streams for each processing video
 * - Updates processing store with stream state
 * - Cleans up streams when videos complete or are deleted
 */
export function useProcessingManager() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setStreamState, removeStreamState } = useProcessingStore();
  const viewingVideoSummaryId = useProcessingStore((s) => s.viewingVideoSummaryId);
  const { data: videosData } = useAllVideos();
  const videos = videosData?.videos;

  // Track active streams by videoSummaryId
  const activeStreamsRef = useRef<Map<string, StreamController>>(new Map());

  // Store accessToken in ref to avoid recreating startStream on every token change
  const accessTokenRef = useRef(accessToken);

  // Update ref in effect to avoid assignment during render (React rules)
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  /**
   * Start an SSE stream for a processing video.
   * Returns a controller to abort the stream.
   */
  const startStream = useCallback(
    (videoSummaryId: string): StreamController => {
      const abortController = new AbortController();

      // Initialize stream state
      setStreamState(videoSummaryId, {
        phase: "connecting",
        metadata: null,
        error: null,
      });

      // Start streaming in background
      (async () => {
        try {
          const token = accessTokenRef.current;
          if (!token) return;

          const response = await fetch(
            `${API_URL}/videos/${videoSummaryId}/stream`,
            {
              headers: {
                Accept: "text/event-stream",
                Authorization: `Bearer ${token}`,
              },
              signal: abortController.signal,
            }
          );

          if (!response.ok) {
            setStreamState(videoSummaryId, {
              phase: "error",
              metadata: null,
              error: `HTTP ${response.status}`,
            });
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) return;

          await readManagerSSEStream(reader, videoSummaryId, setStreamState, () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.videos.lists(),
            });
            removeStreamState(videoSummaryId);
            activeStreamsRef.current.delete(videoSummaryId);
          });
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          setStreamState(videoSummaryId, {
            phase: "error",
            metadata: null,
            error: err instanceof Error ? err.message : "Stream failed",
          });
        }
      })();

      return {
        abort: () => abortController.abort(),
        videoSummaryId,
      };
    },
    [queryClient, setStreamState, removeStreamState]
  );

  /**
   * Effect to manage streams based on video list.
   * Starts streams for processing videos, cleans up completed ones.
   */
  useEffect(() => {
    if (!isAuthenticated || !videos) return;

    // Find videos that are currently processing
    const processingVideos = videos.filter(
      (v) => v.status === "pending" || v.status === "processing"
    );

    // If user is viewing a video's detail page, abort the manager stream
    // (the page-level stream takes priority to show full content)
    if (viewingVideoSummaryId && activeStreamsRef.current.has(viewingVideoSummaryId)) {
      const controller = activeStreamsRef.current.get(viewingVideoSummaryId)!;
      controller.abort();
      activeStreamsRef.current.delete(viewingVideoSummaryId);
      removeStreamState(viewingVideoSummaryId);
    }

    // Start streams for videos that don't have one yet
    // Skip the video currently being viewed (page-level stream handles it)
    for (const video of processingVideos) {
      const { videoSummaryId } = video;
      if (
        !activeStreamsRef.current.has(videoSummaryId) &&
        videoSummaryId !== viewingVideoSummaryId
      ) {
        const controller = startStream(videoSummaryId);
        activeStreamsRef.current.set(videoSummaryId, controller);
      }
    }

    // Clean up streams for videos that are no longer processing
    const processingIds = new Set(processingVideos.map((v) => v.videoSummaryId));
    const toRemove: string[] = [];
    for (const [videoSummaryId] of activeStreamsRef.current) {
      if (!processingIds.has(videoSummaryId)) toRemove.push(videoSummaryId);
    }
    for (const id of toRemove) {
      activeStreamsRef.current.get(id)?.abort();
      activeStreamsRef.current.delete(id);
      removeStreamState(id);
    }
  }, [isAuthenticated, videos, viewingVideoSummaryId, startStream, removeStreamState]);

  /**
   * Cleanup all streams on unmount.
   */
  useEffect(() => {
    // Capture ref value inside effect to use in cleanup
    const streams = activeStreamsRef.current;
    return () => {
      for (const controller of streams.values()) {
        controller.abort();
      }
      streams.clear();
    };
  }, []);

  /**
   * Cleanup streams when user logs out.
   */
  useEffect(() => {
    if (!isAuthenticated) {
      for (const controller of activeStreamsRef.current.values()) {
        controller.abort();
      }
      activeStreamsRef.current.clear();
      useProcessingStore.getState().clearAllStreams();
    }
  }, [isAuthenticated]);
}
