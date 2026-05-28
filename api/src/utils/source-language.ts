import { z } from 'zod';
import type { SourceLanguageBlock } from '@vie/types';

/**
 * Runtime guard for the source-language nested block written by the
 * summarizer's translation phase. Mirrors `@vie/types.SourceLanguageBlock`
 * so any drift between summarizer + FE + API surfaces here as a parse
 * failure instead of a silent shape mismatch leaking to the browser.
 */
// Mirrors `@vie/types.SourceLanguageBlock`. The summarizer writes
// `{code, name, isRTL, tabs, meta}` — synthesis is derived from meta on the
// FE (`buildSynthesisFromMeta`) and is intentionally NOT serialized in this
// block. Any field drift between summarizer and FE should surface here as a
// parse failure, not a silent shape mismatch leaking to the browser.
const SourceLanguageSchema = z.object({
  code: z.string(),
  name: z.string(),
  isRTL: z.boolean(),
  tabs: z.array(z.unknown()),
  meta: z.record(z.unknown()),
});

/**
 * Parse an unknown value into a `SourceLanguageBlock` or `null`. Returns
 * `null` for absent fields AND for shapes that don't validate — the read
 * path treats malformed data as "no translation available" rather than
 * surfacing a 500. The summarizer is responsible for writing a valid block;
 * if it doesn't, the FE simply shows the English-primary tabs.
 */
export function parseSourceLanguage(value: unknown): SourceLanguageBlock | null {
  if (value == null) return null;
  const result = SourceLanguageSchema.safeParse(value);
  if (!result.success) return null;
  // Zod validates the structural shape — tabs/meta are kept as loose
  // containers here because the strict TabEntry/VIEResponseMeta shapes are
  // the summarizer's output contract and the FE's parse target. The API
  // forwards the validated container without re-validating every nested
  // field. The cast bridges the loose runtime shape to the strict @vie/types
  // contract.
  return result.data as unknown as SourceLanguageBlock;
}
