import { create } from "zustand";
import type { StreamState, StreamPhase } from "@/hooks/use-summary-stream";

/**
 * Lightweight stream state for the processing manager.
 * Stores only what's needed for sidebar sync and navigation.
 */
export interface ProcessingStreamState {
  phase: StreamPhase;
  metadata: {
    title?: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null;
  error: string | null;
}

interface ProcessingState {
  /** Active streams indexed by videoSummaryId */
  streams: Map<string, ProcessingStreamState>;

  /** Set or update stream state for a video */
  setStreamState: (videoSummaryId: string, state: ProcessingStreamState) => void;

  /** Remove stream state when processing completes */
  removeStreamState: (videoSummaryId: string) => void;

  /** Get stream state for a specific video */
  getStreamState: (videoSummaryId: string) => ProcessingStreamState | undefined;

  /** Clear all streams (for logout) */
  clearAllStreams: () => void;
}

export const useProcessingStore = create<ProcessingState>((set, get) => ({
  streams: new Map(),

  setStreamState: (videoSummaryId, state) => {
    set((prev) => {
      const newStreams = new Map(prev.streams);
      newStreams.set(videoSummaryId, state);
      return { streams: newStreams };
    });
  },

  removeStreamState: (videoSummaryId) => {
    set((prev) => {
      const newStreams = new Map(prev.streams);
      newStreams.delete(videoSummaryId);
      return { streams: newStreams };
    });
  },

  getStreamState: (videoSummaryId) => {
    return get().streams.get(videoSummaryId);
  },

  clearAllStreams: () => {
    set({ streams: new Map() });
  },
}));

/**
 * Hook to get stream state for a specific video.
 * Returns undefined if the video is not being processed.
 */
export function useProcessingStreamState(videoSummaryId: string | undefined) {
  return useProcessingStore((state) =>
    videoSummaryId ? state.streams.get(videoSummaryId) : undefined
  );
}

/**
 * Convert full StreamState to lightweight ProcessingStreamState.
 */
export function toProcessingStreamState(state: StreamState): ProcessingStreamState {
  return {
    phase: state.phase,
    metadata: state.metadata,
    error: state.error,
  };
}
