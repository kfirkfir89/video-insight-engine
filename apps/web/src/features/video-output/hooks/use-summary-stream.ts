/**
 * Streaming hook for video summarization.
 *
 * Uses Server-Sent Events (SSE) for real-time streaming
 * of video summary generation via the pipeline output system.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { getUserFriendlyError } from "@/features/video-output/lib/streaming/stream-error-messages";
import { loadStreamCache, saveStreamCache, clearStreamCache } from "@/features/video-output/lib/streaming/stream-cache";
import { processEvent } from "@/features/video-output/lib/streaming/stream-event-processor";
import {
  subscribeToStream,
  abortStream,
  type StreamEvent,
} from "@/features/video-output/lib/streaming/stream-registry";

import type {
  VideoContext,
  TriageResult,
  EnrichmentData,
  SynthesisResult,
  VIEResponseMeta,
  TabEntry,
} from "@vie/types";

export type StreamPhase =
  | "idle"
  | "connecting"
  | "metadata"
  // Pipeline output phases
  | "triage"
  | "extraction"
  | "enrichment"
  | "synthesis"
  | "done"
  | "cancelled"
  | "error";

/** User-facing labels for each streaming phase. Plain verbs, no service jargon. */
export const STREAM_PHASE_LABELS: Record<StreamPhase, string> = {
  idle: "Getting ready…",
  connecting: "Connecting…",
  metadata: "Reading the video…",
  // Pipeline output phases
  triage: "Understanding the topic…",
  extraction: "Pulling out the key info…",
  enrichment: "Building study tools…",
  synthesis: "Writing your summary…",
  done: "Done.",
  cancelled: "Cancelled.",
  error: "Something went wrong.",
};

export interface FrameInfo {
  index: number;
  timestamp: number;
  url: string;
  s3Key?: string;
  ocrText?: string;
  textDensity?: number;
}

// Local types not in shared package
export interface VideoMetadata {
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
  duration?: number;
  context?: VideoContext;
}

export interface StreamState {
  phase: StreamPhase;
  metadata: VideoMetadata | null;
  duration: number | null;
  error: string | null;
  isCached: boolean;
  processingTimeMs: number | null;
  // Warning state for partial failures
  warnings: string[];
  // Celebration trigger — increment to fire a new confetti burst
  confettiCount: number;
  // Pipeline output state (triage pipeline)
  triage: TriageResult | null;
  extractionProgress: { section: string; percent: number } | null;
  domainData: Record<string, unknown> | null;
  enrichment: EnrichmentData | null;
  synthesis: SynthesisResult | null;
  // Assembled output (component-addressed tabs)
  meta: VIEResponseMeta | null;
  tabs: TabEntry[];
  // Progressive rendering state
  tabCount: number;
  tabLabels: { id: string; label: string; emoji: string }[];
  // Frame extraction data
  frames: FrameInfo[];
}

interface UseSummaryStreamOptions {
  videoSummaryId: string;
  enabled: boolean;
  onComplete?: (state: StreamState) => void;
  onError?: (error: string) => void;
}

const initialState: StreamState = {
  phase: "idle",
  metadata: null,
  duration: null,
  error: null,
  isCached: false,
  processingTimeMs: null,
  warnings: [],
  confettiCount: 0,
  // Pipeline output state (triage pipeline)
  triage: null,
  extractionProgress: null,
  domainData: null,
  enrichment: null,
  synthesis: null,
  // Assembled output
  meta: null,
  tabs: [],
  // Progressive rendering state
  tabCount: 0,
  tabLabels: [],
  // Frame extraction data
  frames: [],
};

// Save interval for localStorage cache (ms) - don't save on every update
const CACHE_SAVE_INTERVAL = 2000;

// ─── Hook ───

export function useSummaryStream({
  videoSummaryId,
  enabled,
  onComplete,
  onError,
}: UseSummaryStreamOptions): StreamState & { retry: () => void; stop: () => void } {
  const [state, setState] = useState<StreamState>(initialState);
  const accessToken = useAuthStore((s) => s.accessToken);
  // Track if we've restored from cache to avoid double-restoration
  const cacheRestoredRef = useRef(false);
  // Store callbacks in refs to avoid dependency issues
  // Updated in useEffect (not during render) for concurrent mode safety
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const hasToken = !!accessToken;
  // Active subscription cleanup function from the registry
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // Save state to localStorage periodically for resumption after refresh
  // Uses ref + interval to avoid firing on every state change during streaming
  const stateRef = useRef(state);
  stateRef.current = state;

  const subscribe = useCallback((token: string) => {
    if (!videoSummaryId || !token) return;

    setState({ ...initialState, phase: "connecting" });

    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeToStream(videoSummaryId, token, (event: StreamEvent) => {
      if (event.event === "error" && typeof event.message === "string") {
        const userFriendlyError = getUserFriendlyError(event.message);
        setState((prev) => ({ ...prev, phase: "error", error: userFriendlyError }));
        onErrorRef.current?.(userFriendlyError);
        return;
      }
      processEvent(event, setState);
      if (event.event === "done") {
        setState((prev) => {
          if (prev.phase !== "error") {
            onCompleteRef.current?.(prev);
          }
          return prev;
        });
      }
    });
  }, [videoSummaryId]);

  const retry = useCallback(() => {
    if (accessToken) subscribe(accessToken);
  }, [accessToken, subscribe]);

  const stop = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (videoSummaryId) abortStream(videoSummaryId);
    setState((prev) => ({
      ...prev,
      phase: "cancelled",
      error: "Summarization cancelled by user",
    }));
  }, [videoSummaryId]);

  // Track the last videoSummaryId we started subscribing for
  const lastConnectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (enabled && videoSummaryId && hasToken && lastConnectedIdRef.current !== videoSummaryId) {
      lastConnectedIdRef.current = videoSummaryId;

      // Restore cached state before subscribing (allows resumption after refresh)
      if (!cacheRestoredRef.current) {
        cacheRestoredRef.current = true;
        const cachedState = loadStreamCache(videoSummaryId);
        if (cachedState) {
          setState((prev) => ({ ...prev, ...cachedState }));
        }
      }

      // Pass accessToken explicitly to avoid ref timing issues on initial mount.
      if (accessToken) subscribe(accessToken);
    }

    // When streaming is disabled, reset tracking to allow reconnection
    // when the user returns to the same video
    if (!enabled) {
      lastConnectedIdRef.current = null;
      cacheRestoredRef.current = false;
    }

    // Cleanup: detach this subscriber on dependency change / unmount.
    // The shared stream itself keeps running until the producer signals done,
    // so a StrictMode unmount/remount does NOT abort the SSE fetch.
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [enabled, videoSummaryId, hasToken, accessToken, subscribe]);

  useEffect(() => {
    if (!videoSummaryId || !enabled) return;

    const interval = setInterval(() => {
      const s = stateRef.current;
      // Don't save if stream completed or errored (will be cleared anyway)
      if (s.phase === "done" || s.phase === "error" || s.phase === "cancelled") return;
      // Only save if we have meaningful data to cache
      const hasData = s.synthesis || s.triage || s.domainData || s.metadata || s.tabs.length > 0;
      if (hasData) saveStreamCache(videoSummaryId, s);
    }, CACHE_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [videoSummaryId, enabled]);

  // Clear cache when stream completes (success, error, or cancelled)
  // This prevents stale cache entries from accumulating
  useEffect(() => {
    if (videoSummaryId && (state.phase === "done" || state.phase === "error" || state.phase === "cancelled")) {
      clearStreamCache(videoSummaryId);
    }
  }, [videoSummaryId, state.phase]);

  return { ...state, retry, stop };
}
