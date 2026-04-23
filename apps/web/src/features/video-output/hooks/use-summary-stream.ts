/**
 * Streaming hook for video summarization.
 *
 * Uses Server-Sent Events (SSE) for real-time streaming
 * of video summary generation via the pipeline output system.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { refreshToken, getAccessToken } from "@/api/client";
import { getUserFriendlyError } from "@/features/video-output/lib/streaming/stream-error-messages";
import { loadStreamCache, saveStreamCache, clearStreamCache } from "@/features/video-output/lib/streaming/stream-cache";
import { processEvent } from "@/features/video-output/lib/streaming/stream-event-processor";

import type {
  VideoContext,
  TriageResult,
  EnrichmentData,
  SynthesisResult,
  VIEResponseMeta,
  TabEntry,
} from "@vie/types";
import type { Dispatch, SetStateAction } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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

// ─── Extracted helpers ───

/** Attempt a single token refresh. Returns the new token or null. */
async function attemptTokenRefresh(): Promise<string | null> {
  const refreshed = await refreshToken();
  if (refreshed) {
    return getAccessToken();
  }
  return null;
}

/** Handle 401 responses — refresh token once, force logout on failure.
 * Returns the new token if refresh succeeded, null if retry should not happen. */
async function handleUnauthorized(
  tokenRefreshAttemptedRef: { current: boolean },
): Promise<string | null> {
  if (tokenRefreshAttemptedRef.current) return null;
  tokenRefreshAttemptedRef.current = true;
  const newToken = await attemptTokenRefresh();
  if (newToken) return newToken;
  useAuthStore.getState().forceLogout("Session expired. Please log in again.");
  return null;
}

/** Read SSE lines from a ReadableStream, calling processEvent for each. */
async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  setState: Dispatch<SetStateAction<StreamState>>,
): Promise<void> {
  const decoder = new TextDecoder();
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
        processEvent(event, setState);
      } catch (parseErr) {
        if (import.meta.env.DEV) {
          console.debug("[SSE] Failed to parse event data:", data.slice(0, 200), parseErr);
        }
      }
    }
  }
}

// ─── Hook ───

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
  // Track if we've restored from cache to avoid double-restoration
  const cacheRestoredRef = useRef(false);
  // Track if we're currently connecting to prevent duplicate connections
  const isConnectingRef = useRef(false);
  // Store callbacks in refs to avoid dependency issues
  // Updated in useEffect (not during render) for concurrent mode safety
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  // Store accessToken in ref to use in cleanup without triggering re-connection on refresh.
  // Use boolean `hasToken` as a dep to trigger reconnection on login/logout transitions.
  const accessTokenRef = useRef(accessToken);
  const hasToken = !!accessToken;

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    accessTokenRef.current = accessToken;
  }, [onComplete, onError, accessToken]);

  // Save state to localStorage periodically for resumption after refresh
  // Uses ref + interval to avoid firing on every state change during streaming
  const stateRef = useRef(state);
  stateRef.current = state;

  const connect = useCallback(async (tokenOverride?: string) => {
    // Prevent duplicate connections
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    // Use explicit override first, then current ref value (updated via useEffect)
    const currentToken = tokenOverride || accessTokenRef.current;
    if (!videoSummaryId || !currentToken) {
      isConnectingRef.current = false;
      return;
    }

    setState({ ...initialState, phase: "connecting" });
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
      if (response.status === 401) {
        const newToken = await handleUnauthorized(tokenRefreshAttemptedRef);
        if (newToken) {
          isConnectingRef.current = false;
          return connect(newToken);
        }
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Reset refresh flag on successful connection
      tokenRefreshAttemptedRef.current = false;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      await readSSEStream(reader, setState);

      isConnectingRef.current = false;
      // Read final state from the updater to guarantee we see all committed updates.
      setState((prev) => {
        if (prev.phase !== "error") {
          onCompleteRef.current?.(prev);
        }
        return prev;
      });
    } catch (err) {
      isConnectingRef.current = false;
      tokenRefreshAttemptedRef.current = false;
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
    }
  }, [videoSummaryId]);

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
    // Only connect if:
    // 1. Streaming is enabled
    // 2. We have a valid videoSummaryId and accessToken
    // 3. We haven't already started connecting for this videoSummaryId
    if (enabled && videoSummaryId && hasToken && lastConnectedIdRef.current !== videoSummaryId) {
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

      // Pass accessToken explicitly to avoid ref timing issues on initial mount.
      // Guard against null — hasToken may be true from a stale closure while accessToken is refreshing.
      if (accessToken) connect(accessToken);
    }

    // When streaming is disabled, reset tracking to allow reconnection
    // when the user returns to the same video
    if (!enabled) {
      lastConnectedIdRef.current = null;
      cacheRestoredRef.current = false;
    }

    // Cleanup: abort any in-flight request when dependencies change or unmount
    return () => {
      abortControllerRef.current?.abort();
    };
    // connect is memoized on [videoSummaryId] which is already a dep,
    // so including it doesn't cause extra reconnections
  }, [enabled, videoSummaryId, hasToken, connect]);

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
