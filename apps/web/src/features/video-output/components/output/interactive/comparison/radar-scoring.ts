import type { ReviewComparison } from '@vie/types';

// ─── Radar scoring (merged from the retired ComparisonRadar) ───

const RADAR_MIN_AXES = 3;
export const DEFAULT_WEIGHT = 5;
export const MAX_SCORE = 10;

export interface AxisScore {
  feature: string;
  left: number;
  right: number;
  /** Whether scores came from numeric extraction (vs winner-based fallback). */
  isNumeric: boolean;
}

function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * Normalises a comparison row to a pair of 0–10 scores per side. Numeric
 * sides scale so the larger is 10; otherwise winner-based fallback
 * (left=8/right=5 or flipped, tie=6/6). Exported for unit testing.
 */
export function scoreComparisonAxes(comparisons: ReviewComparison[]): AxisScore[] {
  return comparisons.map((row) => {
    const left = parseNumeric(row.thisProduct);
    const right = parseNumeric(row.competitor);
    if (left != null && right != null) {
      const max = Math.max(Math.abs(left), Math.abs(right), 1);
      return {
        feature: row.feature,
        left: clamp01(left / max) * MAX_SCORE,
        right: clamp01(right / max) * MAX_SCORE,
        isNumeric: true,
      };
    }
    if (row.winner === 'left') return { feature: row.feature, left: 8, right: 5, isNumeric: false };
    if (row.winner === 'right') return { feature: row.feature, left: 5, right: 8, isNumeric: false };
    return { feature: row.feature, left: 6, right: 6, isNumeric: false };
  });
}

/** Scoreable axes = comparison rows; radar degenerates below 3 spokes. */
export function hasRadarAxes(comparisons: ReviewComparison[]): boolean {
  return comparisons.length >= RADAR_MIN_AXES;
}
