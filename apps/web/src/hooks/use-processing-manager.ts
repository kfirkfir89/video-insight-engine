/**
 * Processing Manager Hook
 *
 * App-level hook that automatically manages SSE streams for all processing videos.
 * Enables auto-resume after browser refresh and sidebar sync without user interaction.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useProcessingStore } from "@/stores/processing-store";
import { useAllVideos } from "@/hooks/use-videos";
import { queryKeys } from "@/lib/query-keys";
import { sseLogger } from "@/lib/sse-logger";
import {
  validatePhaseEvent,
  validateMetadataEvent,
  validateSection,
  validateErrorEvent,
} from "@/lib/sse-validators";
import type { StreamPhase } from "@/hooks/use-summary-stream";
import type { Section } from "@/types";

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
  sections: Section[];
  error?: string | null;
}

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
        sectionsCount: 0,
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
              sectionsCount: 0,
              error: `HTTP ${response.status}`,
            });
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) return;

          const decoder = new TextDecoder();
          let buffer = "";
          let currentState: Partial<ManagerState> = {
            phase: "connecting" as StreamPhase,
            metadata: null,
            sections: [],
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
                currentState = processEvent(event, currentState);

                // Update store with lightweight state
                setStreamState(videoSummaryId, {
                  phase: currentState.phase as StreamPhase,
                  metadata: currentState.metadata || null,
                  sectionsCount: currentState.sections?.length || 0,
                  error: currentState.error || null,
                });

                // Handle completion
                if (event.event === "done") {
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.videos.lists(),
                  });
                  removeStreamState(videoSummaryId);
                  activeStreamsRef.current.delete(videoSummaryId);
                }
              } catch (err) {
                sseLogger.warn('Failed to parse SSE event:', err instanceof Error ? err.message : String(err));
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          setStreamState(videoSummaryId, {
            phase: "error",
            metadata: null,
            sectionsCount: 0,
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

    // Start streams for videos that don't have one yet
    for (const video of processingVideos) {
      const { videoSummaryId } = video;
      if (!activeStreamsRef.current.has(videoSummaryId)) {
        const controller = startStream(videoSummaryId);
        activeStreamsRef.current.set(videoSummaryId, controller);
      }
    }

    // Clean up streams for videos that are no longer processing
    const processingIds = new Set(processingVideos.map((v) => v.videoSummaryId));
    for (const [videoSummaryId, controller] of activeStreamsRef.current) {
      if (!processingIds.has(videoSummaryId)) {
        controller.abort();
        activeStreamsRef.current.delete(videoSummaryId);
        removeStreamState(videoSummaryId);
      }
    }
  }, [isAuthenticated, videos, startStream, removeStreamState]);

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

/**
 * Process SSE event and update state.
 * Uses validators from sse-validators.ts for type safety.
 */
function processEvent(
  event: Record<string, unknown>,
  state: Partial<ManagerState>
): Partial<ManagerState> {
  const eventType = event.event as string;

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

    case "section_ready":
    case "section_complete": {
      const section = validateSection(event.section);
      if (!section) return state;
      return { ...state, sections: [...(state.sections || []), section] };
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
