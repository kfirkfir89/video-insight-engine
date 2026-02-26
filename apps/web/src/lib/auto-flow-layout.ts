import type { ContentBlock, ContentBlockType } from '@vie/types';
import { SIDEBAR_COMPATIBLE_TYPES } from './block-layout';
import type { BlockMeasurement, ContentWeight } from './content-weight';
import { getTypeFallbackWeight } from './content-weight';

// ─────────────────────────────────────────────────────
// Auto-Flow Layout Engine (Enhanced)
// ─────────────────────────────────────────────────────

/**
 * Maximum consecutive micro blocks consumed into a single equal-4 row.
 * Matches the CSS `.flow-grid-equal-4` container query which supports
 * up to 4 columns at 700px+ container width (see index.css).
 */
const MICRO_RUN_MAX = 4;

export type FlowRowType =
  | 'full'
  | 'sidebar-main'
  | 'equal-2'
  | 'equal-3'
  | 'equal-4';

export interface FlowRow {
  type: FlowRowType;
  columns: ContentBlock[][];
}

/**
 * Complementary block type pairs that work well side-by-side.
 * When adjacent, they get priority for pairing.
 */
export const COMPLEMENTARY_PAIRS: ReadonlyArray<[ContentBlockType, ContentBlockType]> = [
  ['verdict', 'rating'],
  ['cost', 'nutrition'],
  ['guest', 'quote'],
];

function isComplementaryPair(a: ContentBlockType, b: ContentBlockType): boolean {
  return COMPLEMENTARY_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

/** Get a block's weight from the measurement map or fall back to type-based. */
function getWeight(
  block: ContentBlock,
  measurements?: Map<string, BlockMeasurement>,
): ContentWeight {
  if (measurements) {
    const m = measurements.get(block.blockId);
    if (m) return m.weight;
  }
  return getTypeFallbackWeight(block.type);
}

/**
 * Batch consecutive micro-weight blocks into equal-4/3/2 rows.
 *
 * Remainder of 1 is intentionally left unconsumed — the caller's
 * `while` loop picks it up on the next iteration, where it may
 * pair with the following block or fall through as a full row.
 */
function batchMicroRun(
  sidebarRun: ContentBlock[],
  microCount: number,
): { rows: FlowRow[]; consumed: number } {
  const rows: FlowRow[] = [];
  let consumed = 0;
  while (consumed + 4 <= microCount) {
    rows.push({ type: 'equal-4', columns: sidebarRun.slice(consumed, consumed + 4).map(b => [b]) });
    consumed += 4;
  }
  const remainder = microCount - consumed;
  if (remainder === 3) {
    rows.push({ type: 'equal-3', columns: sidebarRun.slice(consumed, consumed + 3).map(b => [b]) });
    consumed += 3;
  } else if (remainder === 2) {
    rows.push({ type: 'equal-2', columns: sidebarRun.slice(consumed, consumed + 2).map(b => [b]) });
    consumed += 2;
  }
  // remainder === 1: intentionally unconsumed — handled by caller's next iteration
  return { rows, consumed };
}

/** Pair sidebar-compatible blocks into equal-2 rows, with odd-one-out handling. */
function pairSidebarRun(
  sidebarRun: ContentBlock[],
  blocks: ContentBlock[],
  runEndIdx: number,
): { rows: FlowRow[]; nextIdx: number } {
  const rows: FlowRow[] = [];
  let j = runEndIdx;
  for (let k = 0; k < sidebarRun.length; k += 2) {
    if (k + 1 < sidebarRun.length) {
      rows.push({ type: 'equal-2', columns: [[sidebarRun[k]], [sidebarRun[k + 1]]] });
    } else {
      // Odd one out → check if next block after run is full-width
      const nextAfterRun = j < blocks.length ? blocks[j] : null;
      if (nextAfterRun && !SIDEBAR_COMPATIBLE_TYPES.has(nextAfterRun.type)) {
        rows.push({ type: 'sidebar-main', columns: [[sidebarRun[k]], [nextAfterRun]] });
        j++;
      } else {
        rows.push({ type: 'full', columns: [[sidebarRun[k]]] });
      }
    }
  }
  return { rows, nextIdx: j };
}

/**
 * Computes an auto-flow layout for a list of blocks.
 *
 * Enhanced algorithm (greedy, left-to-right) with content-aware sizing:
 * 1. `expanded` blocks → always `full` row
 * 2. Complementary pairs get priority pairing
 * 3. `standard` + adjacent `compact`/`micro` → `sidebar-main`
 * 4. 4+ consecutive `micro` → `equal-4` row
 * 5. 3 consecutive `compact` → `equal-3` row
 * 6. 2 consecutive sidebar-compatible → `equal-2`
 * 7. Everything else → `full` row
 * 8. Backward compat: works without measurements (type-based fallback)
 *
 * NOTE: The greedy pairing is order-sensitive — block ordering in the input
 * directly affects which blocks get paired.
 */
export function computeAutoFlowLayout(
  blocks: ContentBlock[],
  measurements?: Map<string, BlockMeasurement>,
): FlowRow[] {
  if (blocks.length === 0) return [];

  // Pre-compute weights to avoid repeated Map lookups in inner loops
  const weights: ContentWeight[] = blocks.map(b => getWeight(b, measurements));

  const rows: FlowRow[] = [];
  let i = 0;

  while (i < blocks.length) {
    const current = blocks[i];
    const currentWeight = weights[i];
    const next = i + 1 < blocks.length ? blocks[i + 1] : null;

    // Rule 1: Expanded blocks always full-width
    if (currentWeight === 'expanded') {
      rows.push({ type: 'full', columns: [[current]] });
      i++;
      continue;
    }

    // Rule 2: Complementary pair priority
    if (next && isComplementaryPair(current.type, next.type)) {
      if (SIDEBAR_COMPATIBLE_TYPES.has(current.type) && !SIDEBAR_COMPATIBLE_TYPES.has(next.type)) {
        rows.push({ type: 'sidebar-main', columns: [[current], [next]] });
      } else if (!SIDEBAR_COMPATIBLE_TYPES.has(current.type) && SIDEBAR_COMPATIBLE_TYPES.has(next.type)) {
        rows.push({ type: 'sidebar-main', columns: [[next], [current]] });
      } else {
        rows.push({ type: 'equal-2', columns: [[current], [next]] });
      }
      i += 2;
      continue;
    }

    // Rule 3: full-width + sidebar-compatible → sidebar-main
    if (next && !SIDEBAR_COMPATIBLE_TYPES.has(current.type) && SIDEBAR_COMPATIBLE_TYPES.has(next.type)) {
      const nextWeight = weights[i + 1];
      if (nextWeight !== 'expanded') {
        rows.push({ type: 'sidebar-main', columns: [[next], [current]] });
        i += 2;
        continue;
      }
    }

    // Rule 4-6: Consecutive sidebar-compatible or compact/micro runs
    if (SIDEBAR_COMPATIBLE_TYPES.has(current.type)) {
      const sidebarRun: ContentBlock[] = [current];
      let j = i + 1;
      while (j < blocks.length && SIDEBAR_COMPATIBLE_TYPES.has(blocks[j].type)) {
        if (weights[j] === 'expanded') break;
        sidebarRun.push(blocks[j]);
        j++;
      }

      // Rule 4: micro runs → batch into equal-4/3/2 rows
      let microCount = 0;
      while (microCount < sidebarRun.length && weights[i + microCount] === 'micro') {
        microCount++;
      }
      if (microCount >= MICRO_RUN_MAX) {
        const batch = batchMicroRun(sidebarRun, microCount);
        rows.push(...batch.rows);
        // remainder 0 or 1: 0 means done, 1 falls through to next iteration
        i += batch.consumed;
        continue;
      }

      // Rule 5: 3 consecutive compact/micro → equal-3
      // Note: `standard` weight blocks are intentionally excluded — they need
      // more horizontal space and work better in equal-2 or sidebar-main layouts.
      if (sidebarRun.length >= 3) {
        const first3Weights = [weights[i], weights[i + 1], weights[i + 2]];
        if (first3Weights.every(w => w === 'compact' || w === 'micro')) {
          rows.push({ type: 'equal-3', columns: sidebarRun.slice(0, 3).map(b => [b]) });
          i += 3;
          continue;
        }
      }

      // Rule 6: pair into equal-2 rows
      const paired = pairSidebarRun(sidebarRun, blocks, j);
      rows.push(...paired.rows);
      i = paired.nextIdx;
      continue;
    }

    // Default: full-width row
    rows.push({ type: 'full', columns: [[current]] });
    i++;
  }

  return rows;
}
