/**
 * Platform-aware glyph for the primary modifier key.
 *
 * Mac users expect ⌘; everyone else expects "Ctrl". Centralised so a
 * future tweak (e.g. `userAgentData.platform` once browser support is
 * uniform, or a "Win" glyph) lands in one place instead of drifting
 * across each keyboard-hint chip.
 *
 * SSR-safe: `navigator` may be undefined at module evaluation; returns
 * the conservative default in that case.
 */
export function getCmdGlyph(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /mac/i.test(navigator.userAgent) ? "⌘" : "Ctrl";
}
