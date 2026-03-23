/**
 * localStorage cache for partial streaming state.
 * Enables resumption after page refresh during summarization.
 */

import type { TriageResult, SynthesisResult, VIEResponseMeta, TabEntry } from "@vie/types";
import type { StreamState } from "@/hooks/use-summary-stream";

const streamCacheKey = (id: string) => `vie-stream-cache-${id}`;

// Cache expiry time - 1 hour (covers most video processing scenarios)
const CACHE_EXPIRY_MS = 60 * 60 * 1000;

interface StreamCache {
  triage: TriageResult | null;
  domainData: Record<string, unknown> | null;
  synthesis: SynthesisResult | null;
  metadata: {
    title?: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null;
  // Assembled output
  meta?: VIEResponseMeta | null;
  tabs?: TabEntry[];
  // Progressive rendering
  tabCount?: number;
  tabLabels?: { id: string; label: string; emoji: string }[];
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

    const raw = JSON.parse(cached);

    // Basic shape validation to prevent crashes from stale localStorage across deploys
    if (!raw || typeof raw !== 'object' || typeof raw.timestamp !== 'number') {
      localStorage.removeItem(streamCacheKey(videoSummaryId));
      return null;
    }

    const data = raw as StreamCache;

    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(streamCacheKey(videoSummaryId));
      return null;
    }

    // Only restore if we have meaningful data
    if (!data.triage && !data.domainData && !data.synthesis && !data.metadata && !data.tabs?.length) {
      return null;
    }

    return {
      triage: data.triage,
      domainData: data.domainData,
      synthesis: data.synthesis,
      metadata: data.metadata,
      duration: data.metadata?.duration ?? null,
      // Assembled output
      meta: data.meta ?? null,
      tabs: data.tabs ?? [],
      // Progressive rendering
      tabCount: data.tabCount ?? 0,
      tabLabels: data.tabLabels ?? [],
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
      triage: state.triage,
      domainData: state.domainData,
      synthesis: state.synthesis,
      metadata: state.metadata,
      // Assembled output
      meta: state.meta,
      tabs: state.tabs,
      // Progressive rendering
      tabCount: state.tabCount,
      tabLabels: state.tabLabels,
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
