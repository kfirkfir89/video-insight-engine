import type { SynthesisResult, VIEResponseMeta } from "@vie/types";

/**
 * Reconstruct a SynthesisResult from a meta record (API response or streaming meta).
 * Returns null if meta is null or contains no synthesis fields.
 */
export function buildSynthesisFromMeta(
  meta: VIEResponseMeta | null,
): SynthesisResult | null {
  if (!meta) return null;
  const hasTldr = typeof meta.tldr === 'string' && meta.tldr.length > 0;
  const hasSummary = typeof meta.masterSummary === 'string' && meta.masterSummary.length > 0;
  if (!hasTldr && !hasSummary) return null;
  return {
    tldr: typeof meta.tldr === 'string' ? meta.tldr : '',
    keyTakeaways: Array.isArray(meta.keyTakeaways) ? meta.keyTakeaways as string[] : [],
    masterSummary: typeof meta.masterSummary === 'string' ? meta.masterSummary : '',
    seoDescription: typeof meta.seoDescription === 'string' ? meta.seoDescription : '',
  };
}
