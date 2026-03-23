/**
 * Auto-detect badge color variant from badge text content.
 *
 * Maps data types to semantic color variants so badges consistently
 * communicate meaning: cost=teal, duration=amber, location=blue, etc.
 */

type BadgeColorVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const BADGE_TYPE_PATTERNS: Array<[RegExp, BadgeColorVariant]> = [
  // Cost/price → info (teal-adjacent)
  [/[$¥€£₹₩]|free|cost|price/i, 'info'],
  // Duration/time → warning (amber)
  [/\d+\s*(mins?|hours?|hrs?|secs?|days?|weeks?|months?|ms)\b/i, 'warning'],
  // Difficulty/level → default (purple/primary)
  [/beginner|intermediate|pro|advanced|easy|moderate|hard|expert|level/i, 'default'],
  // Warning/danger → destructive (red)
  [/⚠|warning|tricky|careful|danger|caution/i, 'destructive'],
  // Success/completion → success (green)
  [/✅|verified|complete|done|passed|approved/i, 'success'],
  // Rating → warning (amber, star-like)
  [/⭐|★|michelin|\d\.\d\/|\/10\b|\/5\b/i, 'warning'],
];

/**
 * Detect the semantic variant for a badge based on its text content.
 * Returns 'muted' (gray/neutral) when no pattern matches — safe default for tags/categories.
 */
export function detectBadgeVariant(text: string): BadgeColorVariant {
  for (const [pattern, variant] of BADGE_TYPE_PATTERNS) {
    if (pattern.test(text)) return variant;
  }
  return 'muted';
}
