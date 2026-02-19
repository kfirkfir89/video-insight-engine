/**
 * Streaming hook for video summarization.
 *
 * Uses Server-Sent Events (SSE) for real-time character-by-character streaming
 * of video summary generation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { refreshToken, getAccessToken } from "@/api/client";
import {
  validateChapter,
  validateConcepts,
  validateDescriptionAnalysis,
  validateMetadataEvent,
  validateChaptersEvent,
  validateSynthesisComplete,
  validateDoneEvent,
  validateErrorEvent,
  validatePhaseEvent,
} from "@/lib/sse-validators";

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

// ─────────────────────────────────────────────────────
// Error Message Mapping for Better UX
// ─────────────────────────────────────────────────────

/**
 * Maps error codes and raw error messages to user-friendly text.
 * Provides context-specific messages that help users understand what went wrong.
 */
function getUserFriendlyError(message: string, code?: string): string {
  // Error code mappings (from backend ErrorCode enum)
  const codeMessages: Record<string, string> = {
    NO_TRANSCRIPT: "This video doesn't have captions available. Videos need captions or subtitles to be summarized.",
    VIDEO_TOO_LONG: "This video is too long to summarize. Maximum duration is 4 hours.",
    VIDEO_TOO_SHORT: "This video is too short to summarize. Minimum duration is 30 seconds.",
    VIDEO_UNAVAILABLE: "This video is unavailable. It may be private, deleted, or region-restricted.",
    VIDEO_RESTRICTED: "This video has restrictions that prevent it from being processed.",
    LIVE_STREAM: "Live streams cannot be summarized. Please wait until the stream ends.",
    LLM_ERROR: "Our AI service encountered an issue. Please try again in a few moments.",
    RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
    UNKNOWN_ERROR: "Something went wrong while processing this video. Please try again.",
  };

  // Check if we have a specific code message
  if (code && codeMessages[code]) {
    return codeMessages[code];
  }

  // Pattern matching for common raw error messages
  const patterns: Array<[RegExp, string]> = [
    [/timeout|timed out/i, "The request took too long. This video might be too complex. Please try again."],
    [/rate limit|429/i, "Too many requests. Please wait a moment and try again."],
    [/connection|network|fetch/i, "Connection issue. Please check your internet and try again."],
    [/transcript.*not available|no captions/i, "This video doesn't have captions available."],
    [/video.*unavailable|private video/i, "This video is unavailable or private."],
    [/authentication|unauthorized|401/i, "Session expired. Please refresh the page."],
    [/server error|500|502|503/i, "Our servers are having issues. Please try again later."],
  ];

  for (const [pattern, friendlyMessage] of patterns) {
    if (pattern.test(message)) {
      return friendlyMessage;
    }
  }

  // If message is already user-friendly (starts with capital, proper sentence), keep it
  if (/^[A-Z].*[.!]$/.test(message) && message.length < 150) {
    return message;
  }

  // Default fallback
  return "Something went wrong while processing this video. Please try again.";
}

// LocalStorage cache key for partial streaming state
const STREAM_CACHE_KEY = (id: string) => `vie-stream-cache-${id}`;

interface StreamCache {
  chapters: SummaryChapter[];
  concepts: Concept[];
  tldr: string;
  keyTakeaways: string[];
  metadata: {
    title?: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null;
  timestamp: number;
}

// Cache expiry time - 1 hour (covers most video processing scenarios)
const CACHE_EXPIRY_MS = 60 * 60 * 1000;

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
};

// Batch interval for token updates (ms) - balance between responsiveness and performance
const TOKEN_BATCH_INTERVAL = 50;

// Save interval for localStorage cache (ms) - don't save on every update
const CACHE_SAVE_INTERVAL = 2000;

/**
 * Load cached streaming state from localStorage.
 * Returns null if no cache exists or cache is expired.
 */
function loadStreamCache(videoSummaryId: string): Partial<StreamState> | null {
  try {
    const cached = localStorage.getItem(STREAM_CACHE_KEY(videoSummaryId));
    if (!cached) return null;

    const data: StreamCache = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(STREAM_CACHE_KEY(videoSummaryId));
      return null;
    }

    // Only restore if we have meaningful data
    if (data.chapters.length === 0 && !data.tldr && data.concepts.length === 0 && !data.metadata) {
      return null;
    }

    return {
      chapters: data.chapters,
      concepts: data.concepts,
      tldr: data.tldr,
      keyTakeaways: data.keyTakeaways,
      metadata: data.metadata,
      duration: data.metadata?.duration ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Save streaming state to localStorage for resumption after refresh.
 */
function saveStreamCache(videoSummaryId: string, state: StreamState): void {
  try {
    const cache: StreamCache = {
      chapters: state.chapters,
      concepts: state.concepts,
      tldr: state.tldr,
      keyTakeaways: state.keyTakeaways,
      metadata: state.metadata,
      timestamp: Date.now(),
    };
    localStorage.setItem(STREAM_CACHE_KEY(videoSummaryId), JSON.stringify(cache));
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
  }
}

/**
 * Clear cached streaming state when summarization completes.
 */
function clearStreamCache(videoSummaryId: string): void {
  try {
    localStorage.removeItem(STREAM_CACHE_KEY(videoSummaryId));
  } catch {
    // Ignore errors
  }
}

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

function processEvent(
  event: Record<string, unknown>,
  setState: React.Dispatch<React.SetStateAction<StreamState>>,
  streamingTextRef: React.RefObject<string>,
  scheduleTokenUpdate: (phase: string, text: string, index: number) => void,
  flushTokenUpdate: () => void
): void {
  const eventType = event.event as string;

  switch (eventType) {
    case "cached":
      setState((prev) => ({ ...prev, isCached: true }));
      break;

    case "phase": {
      // Issue #11: Runtime validation for phase events
      const phase = validatePhaseEvent(event);
      if (phase) {
        streamingTextRef.current = "";
        setState((prev) => ({ ...prev, phase }));
      }
      break;
    }

    case "metadata": {
      // Issue #11: Runtime validation for SSE events
      const metadata = validateMetadataEvent(event);
      setState((prev) => ({
        ...prev,
        phase: "metadata",
        metadata,
        duration: metadata.duration ?? null,
      }));
      break;
    }

    case "chapters": {
      // Issue #11: Runtime validation for SSE events
      const { chapters: detected, isCreatorChapters } = validateChaptersEvent(event);
      setState((prev) => ({
        ...prev,
        detectedChapters: detected,
        isCreatorChapters,
      }));
      break;
    }

    case "description_analysis": {
      // Issue #11: Runtime validation for SSE events
      const analysis = validateDescriptionAnalysis(event);
      if (analysis) {
        setState((prev) => ({
          ...prev,
          descriptionAnalysis: analysis,
        }));
      }
      break;
    }

    case "transcript_ready":
      setState((prev) => ({
        ...prev,
        phase: "transcript",
        duration: event.duration as number | null,
      }));
      break;

    case "token": {
      const phase = event.phase as string;
      const token = event.token as string;
      // Use mutable ref pattern for performance - streamingTextRef.current is a string
      streamingTextRef.current += token;
      const currentText = streamingTextRef.current;

      // Batch token updates to reduce re-renders (50ms interval)
      scheduleTokenUpdate(phase, currentText, event.index as number);
      break;
    }

    case "sections_detected":
    case "chapters_detected":
      setState((prev) => ({ ...prev, phase: "chapter_summaries" }));
      break;

    case "chapter_start":
      // Flush any pending token updates before starting new chapter
      flushTokenUpdate();
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        currentChapterIndex: event.index as number,
        currentChapterText: "",
      }));
      break;

    case "chapter_complete": {
      // Flush pending token updates before completing chapter
      flushTokenUpdate();
      // Issue #11: Runtime validation for SSE events
      const chapter = validateChapter(event.chapter);
      if (!chapter) break;
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        chapters: [...prev.chapters, chapter],
        currentChapterText: "",
        currentChapterIndex: -1,
      }));
      break;
    }

    case "chapter_ready": {
      // Flush pending token updates before chapter is ready
      flushTokenUpdate();
      // Issue #11: Runtime validation for SSE events
      const index = event.index as number;
      const chapter = validateChapter(event.chapter);
      if (!chapter) break;
      streamingTextRef.current = "";
      setState((prev) => {
        // Insert chapter at the correct index position
        const newChapters = [...prev.chapters];
        // Find the right insertion point to keep chapters sorted by startSeconds
        const insertAt = newChapters.findIndex(
          (c) => c.startSeconds > chapter.startSeconds
        );
        if (insertAt === -1) {
          newChapters.push(chapter);
        } else {
          newChapters.splice(insertAt, 0, chapter);
        }

        // Update chapter status
        const newStatuses = { ...prev.chapterStatuses, [index]: "completed" as const };

        return {
          ...prev,
          chapters: newChapters,
          chapterStatuses: newStatuses,
          currentChapterText: "",
          currentChapterIndex: -1,
        };
      });
      break;
    }

    case "concepts_complete": {
      // Issue #11: Runtime validation for SSE events
      const concepts = validateConcepts(event.concepts);
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        concepts,
      }));
      break;
    }

    case "master_summary_complete": {
      const masterSummary = (event.masterSummary as string) || null;
      setState((prev) => ({
        ...prev,
        masterSummary,
      }));
      break;
    }

    case "synthesis_complete": {
      // Flush pending token updates before synthesis completes
      flushTokenUpdate();
      // Issue #11: Runtime validation for SSE events
      const { tldr, keyTakeaways } = validateSynthesisComplete(event);
      setState((prev) => ({
        ...prev,
        tldr,
        keyTakeaways,
      }));
      break;
    }

    case "done": {
      // Issue #11: Runtime validation for SSE events
      const processingTimeMs = validateDoneEvent(event);
      setState((prev) => ({
        ...prev,
        phase: "done",
        processingTimeMs,
      }));
      break;
    }

    case "error": {
      // Issue #11: Runtime validation for SSE events
      const { message, code } = validateErrorEvent(event);
      const userFriendlyError = getUserFriendlyError(message, code);
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: userFriendlyError,
      }));
      break;
    }

    case "warning": {
      // Handle partial failures - some analyses may have failed but processing continues
      const message = (event.message as string) || "Some operations completed with warnings";
      const failedTasks = (event.failedTasks as string[]) || [];
      const warningText = failedTasks.length > 0
        ? `${message} (failed: ${failedTasks.join(", ")})`
        : message;
      setState((prev) => ({
        ...prev,
        warnings: [...prev.warnings, warningText],
      }));
      // Log for debugging but don't interrupt the stream
      console.warn("[SSE Warning]", warningText);
      break;
    }
  }
}
