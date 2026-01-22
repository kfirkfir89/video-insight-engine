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
  validateSection,
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
  Section,
  Concept,
  Chapter,
  DescriptionLink,
  Resource,
  RelatedVideo,
  DescriptionTimestamp,
  SocialLink,
  DescriptionAnalysis,
  VideoContext,
} from "@vie/types";

// Re-export types for backward compatibility with existing consumers
export type {
  Section,
  Concept,
  Chapter,
  DescriptionLink,
  Resource,
  RelatedVideo,
  DescriptionTimestamp,
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
  | "section_detect"
  | "section_summaries"
  | "concepts"
  | "master_summary"
  | "synthesis"
  | "done"
  | "cancelled"
  | "error";

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
  sections: Section[];
  currentSectionIndex: number;
  currentSectionText: string;
  concepts: Concept[];
  tldr: string;
  keyTakeaways: string[];
  masterSummary: string | null;
  error: string | null;
  isCached: boolean;
  processingTimeMs: number | null;
  // Progressive summarization fields
  chapters: Chapter[];
  isCreatorChapters: boolean;
  descriptionAnalysis: DescriptionAnalysis | null;
  sectionStatuses: Record<number, "pending" | "processing" | "completed">;
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
  sections: [],
  currentSectionIndex: -1,
  currentSectionText: "",
  concepts: [],
  tldr: "",
  keyTakeaways: [],
  masterSummary: null,
  error: null,
  isCached: false,
  processingTimeMs: null,
  // Progressive summarization fields
  chapters: [],
  isCreatorChapters: false,
  descriptionAnalysis: null,
  sectionStatuses: {},
  warnings: [],
};

// Batch interval for token updates (ms) - balance between responsiveness and performance
const TOKEN_BATCH_INTERVAL = 50;

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

    if (pending.phase === "section_summary") {
      setState((prev) => ({
        ...prev,
        currentSectionText: pending.text,
        currentSectionIndex: pending.index,
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

      const errorMessage =
        err instanceof Error ? err.message : "Connection failed";

      setState((prev) => ({
        ...prev,
        phase: "error",
        error: errorMessage,
      }));
      onErrorRef.current?.(errorMessage);

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
      connect();
    }

    // When streaming is disabled, reset tracking to allow reconnection
    // when the user returns to the same video
    if (!enabled) {
      lastConnectedIdRef.current = null;
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
      const { chapters, isCreatorChapters } = validateChaptersEvent(event);
      setState((prev) => ({
        ...prev,
        chapters,
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
      setState((prev) => ({ ...prev, phase: "section_summaries" }));
      break;

    case "section_start":
      // Flush any pending token updates before starting new section
      flushTokenUpdate();
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        currentSectionIndex: event.index as number,
        currentSectionText: "",
      }));
      break;

    case "section_complete": {
      // Flush pending token updates before completing section
      flushTokenUpdate();
      // Issue #11: Runtime validation for SSE events
      const section = validateSection(event.section);
      if (!section) break;
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        sections: [...prev.sections, section],
        currentSectionText: "",
        currentSectionIndex: -1,
      }));
      break;
    }

    case "section_ready": {
      // Flush pending token updates before section is ready
      flushTokenUpdate();
      // Issue #11: Runtime validation for SSE events
      const index = event.index as number;
      const section = validateSection(event.section);
      if (!section) break;
      streamingTextRef.current = "";
      setState((prev) => {
        // Insert section at the correct index position
        const newSections = [...prev.sections];
        // Find the right insertion point to keep sections sorted by index
        const insertAt = newSections.findIndex(
          (s) => s.startSeconds > section.startSeconds
        );
        if (insertAt === -1) {
          newSections.push(section);
        } else {
          newSections.splice(insertAt, 0, section);
        }

        // Update section status
        const newStatuses = { ...prev.sectionStatuses, [index]: "completed" as const };

        return {
          ...prev,
          sections: newSections,
          sectionStatuses: newStatuses,
          currentSectionText: "",
          currentSectionIndex: -1,
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
      const { message } = validateErrorEvent(event);
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: message,
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
