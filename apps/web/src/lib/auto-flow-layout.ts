import type { ContentBlock, ContentBlockType } from '@vie/types';
import { SIDEBAR_COMPATIBLE_TYPES } from './block-layout';

// ─────────────────────────────────────────────────────
// Auto-Flow Layout Engine
// ─────────────────────────────────────────────────────

export interface FlowRow {
  type: 'sidebar-main' | 'equal-2' | 'full';
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

/**
 * Computes an auto-flow layout for a list of blocks.
 *
 * Algorithm (greedy, left-to-right):
 * 1. Scan blocks sequentially
 * 2. When a sidebar-compatible block is adjacent to a non-sidebar block,
 *    pair them into a sidebar-main row
 * 3. When 2+ consecutive sidebar-compatible blocks appear, render as equal-2 row
 * 4. Everything else renders as a full row
 * 5. Complementary pairs get priority pairing
 *
 * NOTE: The greedy pairing is order-sensitive — block ordering in the input
 * directly affects which blocks get paired. Reordering blocks may produce
 * different layouts even with the same set of block types.
 */
export function computeAutoFlowLayout(blocks: ContentBlock[]): FlowRow[] {
  if (blocks.length === 0) return [];

  const rows: FlowRow[] = [];
  let i = 0;

  while (i < blocks.length) {
    const current = blocks[i];
    const next = i + 1 < blocks.length ? blocks[i + 1] : null;

    // Check for complementary pair
    if (next && isComplementaryPair(current.type, next.type)) {
      // Put sidebar-compatible in first column, main in second
      if (SIDEBAR_COMPATIBLE_TYPES.has(current.type) && !SIDEBAR_COMPATIBLE_TYPES.has(next.type)) {
        rows.push({ type: 'sidebar-main', columns: [[current], [next]] });
      } else if (!SIDEBAR_COMPATIBLE_TYPES.has(current.type) && SIDEBAR_COMPATIBLE_TYPES.has(next.type)) {
        rows.push({ type: 'sidebar-main', columns: [[next], [current]] });
      } else {
        // Both are sidebar-compatible complementary pairs → equal-2
        rows.push({ type: 'equal-2', columns: [[current], [next]] });
      }
      i += 2;
      continue;
    }

    // Check for full-width + sidebar-compatible pair (reverse order).
    // Note: the symmetric case (sidebar + full) is handled by the consecutive-sidebar
    // logic below — a run of 1 sidebar block pairs with the next full-width block.
    if (next && !SIDEBAR_COMPATIBLE_TYPES.has(current.type) && SIDEBAR_COMPATIBLE_TYPES.has(next.type)) {
      rows.push({ type: 'sidebar-main', columns: [[next], [current]] });
      i += 2;
      continue;
    }

    // Check for consecutive sidebar-compatible blocks → equal-2 rows
    if (SIDEBAR_COMPATIBLE_TYPES.has(current.type)) {
      const sidebarRun: ContentBlock[] = [current];
      let j = i + 1;
      while (j < blocks.length && SIDEBAR_COMPATIBLE_TYPES.has(blocks[j].type)) {
        sidebarRun.push(blocks[j]);
        j++;
      }

      // Pair them into equal-2 rows
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
      i = j;
      continue;
    }

    // Default: full-width row
    rows.push({ type: 'full', columns: [[current]] });
    i++;
  }

  return rows;
}
