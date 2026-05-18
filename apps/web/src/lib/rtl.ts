/**
 * RTL language detection. Used by DirectionProvider to flip the video output
 * area when the source video language is right-to-left.
 *
 * Scope: video output content only — the app shell stays LTR so users can
 * navigate in their own UI language regardless of the video they're watching.
 */

export type Direction = 'ltr' | 'rtl';

/** ISO 639-1 codes for right-to-left scripts the pipeline can produce. */
export const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'he', // Hebrew
  'ar', // Arabic
  'fa', // Persian / Farsi
  'ur', // Urdu
  'ps', // Pashto
  'sd', // Sindhi
  'yi', // Yiddish
  'ku', // Kurdish (Sorani)
  'dv', // Dhivehi
]);

/**
 * Returns true when the given ISO 639-1 language code is right-to-left.
 * Null/undefined/unknown languages default to false (LTR), matching the
 * fallback in DirectionContext.
 */
export function isRTL(language: string | null | undefined): boolean {
  if (!language) return false;
  return RTL_LANGUAGES.has(language.toLowerCase());
}

/** Convenience helper — returns 'rtl' or 'ltr' for a language code. */
export function directionFor(language: string | null | undefined): Direction {
  return isRTL(language) ? 'rtl' : 'ltr';
}
