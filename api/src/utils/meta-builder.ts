/**
 * Builds a normalized `meta` object from various document shapes.
 *
 * Handles three storage formats:
 *  1. New shape: doc.meta (has contentTags directly)
 *  2. Legacy v2: doc.assembledMeta + doc.synthesis
 *  3. Oldest: doc.triage + doc.synthesis
 */

/** Normalized meta shape returned to the frontend. */
export interface NormalizedMeta {
  contentTags?: string[];
  modifiers?: string[];
  primaryTag?: string;
  userGoal?: string;
  tldr?: string;
  seoDescription?: string;
  masterSummary?: string;
  keyTakeaways?: string[];
  descriptionAnalysis?: unknown;
}

export function buildMetaFromDoc(doc: Record<string, unknown>): NormalizedMeta | null {
  const newMeta = doc.meta as Record<string, unknown> | undefined;
  const oldAssembledMeta = doc.assembledMeta as Record<string, unknown> | undefined;
  const synthesis = doc.synthesis as Record<string, unknown> | undefined;

  let meta: NormalizedMeta = {};

  if (newMeta && newMeta.contentTags) {
    meta = newMeta as NormalizedMeta;
  } else if (oldAssembledMeta) {
    meta = { ...oldAssembledMeta } as NormalizedMeta;
    if (synthesis) {
      meta.tldr = (meta.tldr ?? synthesis.tldr ?? '') as string;
      meta.seoDescription = (meta.seoDescription ?? synthesis.seoDescription ?? '') as string;
      meta.masterSummary = (meta.masterSummary ?? synthesis.masterSummary ?? '') as string;
      meta.keyTakeaways = (meta.keyTakeaways ?? (Array.isArray(synthesis.keyTakeaways) ? synthesis.keyTakeaways : [])) as string[];
    }
    if (doc.descriptionAnalysis) {
      meta.descriptionAnalysis = meta.descriptionAnalysis ?? doc.descriptionAnalysis;
    }
  } else if (doc.triage) {
    const triage = doc.triage as Record<string, unknown>;
    meta = {
      contentTags: (triage.contentTags ?? []) as string[],
      modifiers: (triage.modifiers ?? []) as string[],
      primaryTag: (triage.primaryTag ?? 'learning') as string,
      userGoal: (triage.userGoal ?? '') as string,
    };
    if (synthesis) {
      meta.tldr = (synthesis.tldr ?? '') as string;
      meta.seoDescription = (synthesis.seoDescription ?? '') as string;
      meta.masterSummary = (synthesis.masterSummary ?? '') as string;
      meta.keyTakeaways = (Array.isArray(synthesis.keyTakeaways) ? synthesis.keyTakeaways : []) as string[];
    }
  }

  return Object.keys(meta).length > 0 ? meta : null;
}

/**
 * Extracts tabs from a document, handling both new and legacy shapes.
 */
export function buildTabsFromDoc(doc: Record<string, unknown>): unknown[] | null {
  return (doc.tabs as unknown[] | undefined)
    ?? (doc.assembledTabs as unknown[] | undefined)
    ?? null;
}
