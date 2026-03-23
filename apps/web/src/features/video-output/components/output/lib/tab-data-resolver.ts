/**
 * Deterministic tab→data mapping for VIEResponse.
 * Ignores LLM-designed dataSource strings (unreliable).
 * Falls back to dataSource-based resolution only for unknown tab IDs.
 */
import type { VIEResponse, ContentTag } from '@vie/types';

type Resolver = (r: VIEResponse) => unknown;

const TAB_RESOLVERS: Record<string, Resolver> = {
  // Enrichment (root-level)
  quizzes: (r) => r.quizzes,
  flashcards: (r) => r.flashcards,
  scenarios: (r) => r.scenarios,

  // Review
  verdict: (r) => r.review?.verdict,
  pros_cons: (r) => {
    if (!r.review) return null;
    const { pros, cons, comparisons } = r.review;
    if (!pros?.length && !cons?.length && !comparisons?.length) return null;
    return { pros, cons, comparisons };
  },
  specs: (r) => r.review?.specs,

  // Travel
  itinerary: (r) => r.travel?.itinerary,
  budget: (r) => r.travel?.budget,
  packing: (r) => r.travel?.packingList,

  // Food
  ingredients: (r) => r.food?.ingredients,
  steps: (r) => r.food?.steps ?? r.project?.steps,
  tips: (r) => r.food?.tips ?? r.fitness?.tips,

  // Tech
  code: (r) => r.tech?.snippets,
  setup: (r) => r.tech?.setup,
  patterns: (r) => r.tech?.patterns,
  cheat_sheet: (r) => r.tech?.cheatSheet,
  topics: (r) => r.tech?.topics,

  // Fitness
  exercises: (r) => r.fitness,
  timer: (r) => r.fitness,

  // Music
  analysis: (r) => r.music?.analysis,
  structure: (r) => r.music?.structure,
  lyrics: (r) => r.music?.lyrics,
  credits: (r) => r.music?.credits,

  // Learning
  key_points: (r) => r.learning?.keyPoints,
  concepts: (r) => r.learning?.concepts,
  takeaways: (r) => r.learning?.takeaways ?? r.narrative?.takeaways,
  timestamps: (r) => r.learning?.timestamps,

  // Project
  materials: (r) => r.project?.materials,
  tools: (r) => r.project?.tools,
  safety: (r) => r.project?.safetyWarnings,

  // Narrative (modifier)
  key_moments: (r) => r.narrative?.keyMoments,
  quotes: (r) => r.narrative?.quotes,

  // Overview — build composite from primary domain metadata
  overview: (r) => {
    if (!r.meta?.primaryTag) return null;
    const tag = r.meta.primaryTag;
    if (!(tag in r)) return null;
    const domain = r[tag as keyof VIEResponse];
    if (domain == null || typeof domain !== 'object' || Array.isArray(domain)) return null;
    const obj = domain as unknown as Record<string, unknown>;
    // Extract primitive fields (strings, numbers, booleans) and sub-objects with primitive values
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value == null) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Include flat sub-objects (like meta: { difficulty, servings })
        const sub = value as Record<string, unknown>;
        const primitiveEntries = Object.entries(sub).filter(
          ([, v]) => v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
        );
        if (primitiveEntries.length > 0) {
          for (const [k, v] of primitiveEntries) {
            result[k] = v;
          }
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  },
};

/**
 * Fallback: resolve data using the LLM-provided dataSource string.
 */
function fallbackResolve(response: VIEResponse, _tabId: string, dataSource: string): unknown {
  if (!dataSource) return null;

  const domainKey = dataSource.split('.')[0] as ContentTag;
  const domainData = response[domainKey as keyof VIEResponse] as unknown;
  if (domainData == null) return null;

  const parts = dataSource.split('.');
  if (parts.length > 1) {
    const field = parts[1];
    if (typeof domainData === 'object' && domainData !== null && field in (domainData as Record<string, unknown>)) {
      return (domainData as Record<string, unknown>)[field];
    }
  }

  return domainData;
}

/**
 * Resolve tab data deterministically from VIEResponse.
 * Uses hardcoded tab→field mapping. Falls back to dataSource only for unknown tabs.
 */
export function resolveTabData(response: VIEResponse, tabId: string, dataSource: string): unknown {
  const resolver = TAB_RESOLVERS[tabId];
  if (resolver) {
    const result = resolver(response);
    if (result != null) return result;
  }

  // Fallback: original dataSource-based resolution
  return fallbackResolve(response, tabId, dataSource);
}
