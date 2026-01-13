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
  error: string | null;
  isCached: boolean;
  processingTimeMs: number | null;
  // Progressive summarization fields
  chapters: Chapter[];
  isCreatorChapters: boolean;
  descriptionAnalysis: DescriptionAnalysis | null;
  sectionStatuses: Record<number, "pending" | "processing" | "completed">;
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
  error: null,
  isCached: false,
  processingTimeMs: null,
  // Progressive summarization fields
  chapters: [],
  isCreatorChapters: false,
  descriptionAnalysis: null,
  sectionStatuses: {},
};

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
            processEvent(event, setState, streamingTextRef);
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
  }, [videoSummaryId, accessToken]);

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

    // Cleanup: abort any in-flight request when dependencies change or unmount
    return () => {
      abortControllerRef.current?.abort();
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
  streamingTextRef: React.MutableRefObject<string>
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
      streamingTextRef.current += token;
      const currentText = streamingTextRef.current;

      if (phase === "section_summary") {
        setState((prev) => ({
          ...prev,
          currentSectionText: currentText,
          currentSectionIndex: event.index as number,
        }));
      } else if (phase === "synthesis") {
        setState((prev) => ({ ...prev, tldr: currentText }));
      }
      break;
    }

    case "sections_detected":
      setState((prev) => ({ ...prev, phase: "section_summaries" }));
      break;

    case "section_start":
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        currentSectionIndex: event.index as number,
        currentSectionText: "",
      }));
      break;

    case "section_complete": {
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

    case "synthesis_complete": {
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
  }
}
