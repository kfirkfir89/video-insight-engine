/**
 * Streaming hook for video summarization.
 *
 * Uses Server-Sent Events (SSE) for real-time character-by-character streaming
 * of video summary generation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { refreshToken, getAccessToken } from "@/api/client";
import { getUserFriendlyError } from "@/lib/stream-error-messages";
import { loadStreamCache, saveStreamCache, clearStreamCache } from "@/lib/stream-cache";
import { processEvent } from "@/lib/stream-event-processor";

// Issue #12: Import shared types from @vie/types, re-export for consumers
import type {
  SummaryChapter,
  Concept,
  Chapter,
  DescriptionLink,
  Resource,
  RelatedVideo,
  SocialLink,
  DescriptionAnalysis,
  VideoContext,
  OutputType,
} from "@vie/types";

// Re-export types for consumers
export type {
  SummaryChapter,
  Concept,
  Chapter,
  DescriptionLink,
  Resource,
  RelatedVideo,
  SocialLink,
  DescriptionAnalysis,
  VideoContext,
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export type StreamPhase =
  | "idle"
  | "connecting"
  | "metadata"
  | "transcript"
  | "parallel_analysis"
  | "chapter_detect"
  | "chapter_summaries"
  | "concepts"
  | "master_summary"
  | "synthesis"
  | "done"
  | "cancelled"
  | "error";

/** Human-readable labels for each streaming phase. Co-located with StreamPhase for single source of truth. */
export const STREAM_PHASE_LABELS: Record<StreamPhase, string> = {
  idle: "Preparing...",
  connecting: "Connecting to AI...",
  metadata: "Fetching video info...",
  transcript: "Processing transcript...",
  parallel_analysis: "Analyzing content...",
  chapter_detect: "Analyzing video structure...",
  chapter_summaries: "Summarizing chapters...",
  concepts: "Extracting key concepts...",
  master_summary: "Creating quick read...",
  synthesis: "Generating summary...",
  done: "Complete!",
  cancelled: "Summarization cancelled",
  error: "Error occurred",
};

/**
 * Returns a human-readable label for the current streaming phase.
 * Handles the chapter_summaries special case with chapter index/total context.
 */
export function getStreamingPhaseLabel(
  phase: StreamPhase,
  currentChapterIndex: number,
  totalChapters: number,
): string {
  if (phase === "chapter_summaries" && currentChapterIndex >= 0) {
    return `Summarizing chapter ${currentChapterIndex + 1}${totalChapters > 0 ? ` of ${totalChapters}` : ""}...`;
  }
  return STREAM_PHASE_LABELS[phase];
}

// Local types not in shared package
export interface VideoMetadata {
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
  duration?: number;
  context?: VideoContext;
}

export interface DetectionResult {
  detectedType: OutputType;
  confidence: number;
  alternatives: Array<{ type: string; confidence: number }>;
}

export interface StreamState {
  phase: StreamPhase;
  metadata: VideoMetadata | null;
  duration: number | null;
  chapters: SummaryChapter[];
  currentChapterIndex: number;
  currentChapterText: string;
  concepts: Concept[];
  tldr: string;
  keyTakeaways: string[];
  masterSummary: string | null;
  error: string | null;
  isCached: boolean;
  processingTimeMs: number | null;
  // Progressive summarization fields
  detectedChapters: Chapter[];
  isCreatorChapters: boolean;
  descriptionAnalysis: DescriptionAnalysis | null;
  chapterStatuses: Record<number, "pending" | "processing" | "completed">;
  // Warning state for partial failures (e.g., some analyses failed)
  warnings: string[];
  // Detection result for output type override
  detectionResult: DetectionResult | null;
  // Celebration trigger — increment to fire a new confetti burst
  confettiCount: number;
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
  chapters: [],
  currentChapterIndex: -1,
  currentChapterText: "",
  concepts: [],
  tldr: "",
  keyTakeaways: [],
  masterSummary: null,
  error: null,
  isCached: false,
  processingTimeMs: null,
  // Progressive summarization fields
  detectedChapters: [],
  isCreatorChapters: false,
  descriptionAnalysis: null,
  chapterStatuses: {},
  warnings: [],
  detectionResult: null,
  confettiCount: 0,
};

// Batch interval for token updates (ms) - balance between responsiveness and performance
const TOKEN_BATCH_INTERVAL = 50;

// Save interval for localStorage cache (ms) - don't save on every update
const CACHE_SAVE_INTERVAL = 2000;

export function useSummaryStream({
  videoSummaryId,
  enabled,
  onComplete,
  onError,
}: UseSummaryStreamOptions): StreamState & { retry: () => void; stop: () => void } {
  const [state, setState] = useState<StreamState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const retryCountRef = useRef(0);
  const tokenRefreshAttemptedRef = useRef(false);
  // Track current streaming text outside React state for performance
  const streamingTextRef = useRef("");
  // Track if we've restored from cache to avoid double-restoration
  const cacheRestoredRef = useRef(false);
  // Track last cache save time to throttle saves
  const lastCacheSaveRef = useRef(0);
  // Track if we're currently connecting to prevent duplicate connections
  const isConnectingRef = useRef(false);
  // Store callbacks in refs to avoid dependency issues
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  // Store accessToken in ref to use in cleanup without triggering re-connection
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Batching refs for token updates - reduces re-renders from 100+ to ~20
  const pendingTokenUpdateRef = useRef<{
    phase: string;
    text: string;
    index: number;
  } | null>(null);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush pending token updates to state
  const flushTokenUpdate = useCallback(() => {
    // Prevent state updates after unmount
    if (!isMountedRef.current) return;

    const pending = pendingTokenUpdateRef.current;
    if (!pending) return;

    pendingTokenUpdateRef.current = null;
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    if (pending.phase === "chapter_summary") {
      setState((prev) => ({
        ...prev,
        currentChapterText: pending.text,
        currentChapterIndex: pending.index,
      }));
    } else if (pending.phase === "synthesis") {
      setState((prev) => ({ ...prev, tldr: pending.text }));
    }
  }, []);

  // Schedule batched token update
  const scheduleTokenUpdate = useCallback((phase: string, text: string, index: number) => {
    pendingTokenUpdateRef.current = { phase, text, index };

    // Only schedule if not already scheduled
    if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(flushTokenUpdate, TOKEN_BATCH_INTERVAL);
    }
  }, [flushTokenUpdate]);

  const connect = useCallback(async (tokenOverride?: string) => {
    // Prevent duplicate connections
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    const currentToken = tokenOverride || accessToken;
    if (!videoSummaryId || !currentToken) {
      isConnectingRef.current = false;
      return;
    }

    setState({ ...initialState, phase: "connecting" });
    streamingTextRef.current = "";
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${API_URL}/videos/${videoSummaryId}/stream`,
        {
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${currentToken}`,
          },
          signal: abortControllerRef.current.signal,
        }
      );

      // Handle 401 - try token refresh once
      if (response.status === 401 && !tokenRefreshAttemptedRef.current) {
        tokenRefreshAttemptedRef.current = true;
        const refreshed = await refreshToken();
        if (refreshed) {
          const newToken = getAccessToken();
          if (newToken) {
            return connect(newToken);
          }
        }
        // Refresh failed - force logout and redirect to login
        useAuthStore.getState().forceLogout("Session expired. Please log in again.");
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Reset refresh flag on successful connection
      tokenRefreshAttemptedRef.current = false;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

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
            processEvent(event, setState, streamingTextRef, scheduleTokenUpdate, flushTokenUpdate);
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      isConnectingRef.current = false;
      setState((prev) => {
        if (prev.phase !== "error") {
          onCompleteRef.current?.(prev);
        }
        return prev;
      });
    } catch (err) {
      isConnectingRef.current = false;
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const rawMessage = err instanceof Error ? err.message : "Connection failed";
      const userFriendlyError = getUserFriendlyError(rawMessage);

      setState((prev) => ({
        ...prev,
        phase: "error",
        error: userFriendlyError,
      }));
      onErrorRef.current?.(userFriendlyError);

      // Note: Removed automatic retry to prevent infinite loops.
      // User can manually retry using the retry() function.
    }
  }, [videoSummaryId, accessToken, scheduleTokenUpdate, flushTokenUpdate]);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    tokenRefreshAttemptedRef.current = false;
    isConnectingRef.current = false;
    connect();
  }, [connect]);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    isConnectingRef.current = false;
    setState((prev) => ({
      ...prev,
      phase: "cancelled",
      error: "Summarization cancelled by user",
    }));
  }, []);

  // Track the last videoSummaryId we started connecting for
  const lastConnectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset mounted state on effect run (handles dependency changes)
    isMountedRef.current = true;

    // Only connect if:
    // 1. Streaming is enabled
    // 2. We have a valid videoSummaryId and accessToken
    // 3. We haven't already started connecting for this videoSummaryId
    if (enabled && videoSummaryId && accessToken && lastConnectedIdRef.current !== videoSummaryId) {
      lastConnectedIdRef.current = videoSummaryId;
      retryCountRef.current = 0;
      tokenRefreshAttemptedRef.current = false;
      isConnectingRef.current = false;

      // Restore cached state before connecting (allows resumption after refresh)
      if (!cacheRestoredRef.current) {
        cacheRestoredRef.current = true;
        const cachedState = loadStreamCache(videoSummaryId);
        if (cachedState) {
          setState((prev) => ({ ...prev, ...cachedState }));
        }
      }

      connect();
    }

    // When streaming is disabled, reset tracking to allow reconnection
    // when the user returns to the same video
    if (!enabled) {
      lastConnectedIdRef.current = null;
      cacheRestoredRef.current = false;
    }

    // Cleanup: abort any in-flight request and clear batch timeout when dependencies change or unmount
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      pendingTokenUpdateRef.current = null;
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
    };
    // Issue #10: Intentionally limited deps to prevent infinite loops
    // - connect() uses refs for latest values (accessTokenRef.current)
    // - Including connect would cause reconnection loops on every token change
    // - lastConnectedIdRef prevents duplicate connections for same videoSummaryId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoSummaryId, accessToken]);

  // Save state to localStorage periodically for resumption after refresh
  // Throttled to CACHE_SAVE_INTERVAL to avoid excessive writes
  useEffect(() => {
    if (!videoSummaryId || !enabled) return;

    // Only save if we have meaningful data to cache
    const hasData = state.chapters.length > 0 || state.concepts.length > 0 || state.tldr || state.metadata;
    if (!hasData) return;

    // Don't save if stream completed or errored (will be cleared anyway)
    if (state.phase === "done" || state.phase === "error" || state.phase === "cancelled") return;

    const now = Date.now();
    if (now - lastCacheSaveRef.current >= CACHE_SAVE_INTERVAL) {
      lastCacheSaveRef.current = now;
      saveStreamCache(videoSummaryId, state);
    }
  }, [videoSummaryId, enabled, state]);

  // Clear cache when stream completes (success, error, or cancelled)
  // This prevents stale cache entries from accumulating
  useEffect(() => {
    if (videoSummaryId && (state.phase === "done" || state.phase === "error" || state.phase === "cancelled")) {
      clearStreamCache(videoSummaryId);
    }
  }, [videoSummaryId, state.phase]);

  return { ...state, retry, stop };
}
