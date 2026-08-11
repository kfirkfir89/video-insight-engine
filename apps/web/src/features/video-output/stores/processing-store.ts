import { create } from "zustand";
import type { StreamState, StreamPhase } from "@/features/video-output/hooks/use-summary-stream";

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

  /** Video currently being viewed on the detail page (page-level stream takes priority) */
  viewingVideoSummaryId: string | null;

  /** IDs the user explicitly cancelled in this tab. Prevents the detail page
   *  from auto-resubscribing on return — the user gets a Resume affordance
   *  instead of the stream silently re-attaching to a backend pipeline that
   *  the frontend can't actually abort. */
  cancelledIds: Set<string>;

  /** Set or update stream state for a video */
  setStreamState: (videoSummaryId: string, state: ProcessingStreamState) => void;

  /** Remove stream state when processing completes */
  removeStreamState: (videoSummaryId: string) => void;

  /** Get stream state for a specific video */
  getStreamState: (videoSummaryId: string) => ProcessingStreamState | undefined;

  /** Set the video currently being viewed (detail page takes over streaming) */
  setViewingVideo: (videoSummaryId: string | null) => void;

  /** Mark a video's stream as cancelled by the user. Survives navigation. */
  markCancelled: (videoSummaryId: string) => void;

  /** Clear the cancelled flag so the stream can resubscribe. */
  clearCancelled: (videoSummaryId: string) => void;

  /** Clear all streams (for logout) */
  clearAllStreams: () => void;
}

export const useProcessingStore = create<ProcessingState>((set, get) => ({
  streams: new Map(),
  viewingVideoSummaryId: null,
  cancelledIds: new Set(),

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

  setViewingVideo: (videoSummaryId) => {
    set({ viewingVideoSummaryId: videoSummaryId });
  },

  markCancelled: (videoSummaryId) => {
    set((prev) => {
      const next = new Set(prev.cancelledIds);
      next.add(videoSummaryId);
      return { cancelledIds: next };
    });
  },

  clearCancelled: (videoSummaryId) => {
    set((prev) => {
      if (!prev.cancelledIds.has(videoSummaryId)) return prev;
      const next = new Set(prev.cancelledIds);
      next.delete(videoSummaryId);
      return { cancelledIds: next };
    });
  },

  clearAllStreams: () => {
    set({ streams: new Map(), viewingVideoSummaryId: null, cancelledIds: new Set() });
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
