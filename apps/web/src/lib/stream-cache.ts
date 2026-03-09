/**
 * localStorage cache for partial streaming state.
 * Enables resumption after page refresh during summarization.
 */

import type { IntentResult, OutputData, SynthesisResult } from "@vie/types";
import type { StreamState } from "@/hooks/use-summary-stream";

const streamCacheKey = (id: string) => `vie-stream-cache-${id}`;

// Cache expiry time - 1 hour (covers most video processing scenarios)
const CACHE_EXPIRY_MS = 60 * 60 * 1000;

interface StreamCache {
  intent: IntentResult | null;
  output: OutputData | null;
  synthesis: SynthesisResult | null;
  metadata: {
    title?: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null;
  timestamp: number;
}

/**
 * Load cached streaming state from localStorage.
 * Returns null if no cache exists or cache is expired.
 */
export function loadStreamCache(videoSummaryId: string): Partial<StreamState> | null {
  try {
    const cached = localStorage.getItem(streamCacheKey(videoSummaryId));
    if (!cached) return null;

    const data: StreamCache = JSON.parse(cached);

    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(streamCacheKey(videoSummaryId));
      return null;
    }

    // Only restore if we have meaningful data
    if (!data.intent && !data.output && !data.synthesis && !data.metadata) {
      return null;
    }

    return {
      intent: data.intent,
      output: data.output,
      synthesis: data.synthesis,
      metadata: data.metadata,
      duration: data.metadata?.duration ?? null,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[StreamCache] load failed:", err);
    return null;
  }
}

/**
 * Save streaming state to localStorage for resumption after refresh.
 */
export function saveStreamCache(videoSummaryId: string, state: StreamState): void {
  try {
    const cache: StreamCache = {
      intent: state.intent,
      output: state.output,
      synthesis: state.synthesis,
      metadata: state.metadata,
      timestamp: Date.now(),
    };
    localStorage.setItem(streamCacheKey(videoSummaryId), JSON.stringify(cache));
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[StreamCache] save failed:", err);
  }
}

/**
 * Clear cached streaming state when summarization completes.
 */
export function clearStreamCache(videoSummaryId: string): void {
  try {
    localStorage.removeItem(streamCacheKey(videoSummaryId));
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[StreamCache] clear failed:", err);
  }
}
