import type { ContentBlock, ContentBlockType } from '@vie/types';

export type BlockSize = 'full' | 'half' | 'compact';

export interface BlockGroup {
  size: BlockSize;
  blocks: ContentBlock[];
}

/**
 * Static size classification for each block type.
 * Full-width blocks contain long-form or complex content.
 * Half-width blocks are medium-density (2-col on desktop).
 * Compact blocks are small data points (3-col on desktop).
 *
 * Phase 5: callout, quote, definition, verdict promoted to full
 * (text-heavy blocks shouldn't be crammed side-by-side).
 */
const BLOCK_SIZE_MAP: Record<ContentBlockType, BlockSize> = {
  // Full-width — long-form, complex layout
  paragraph: 'full',
  bullets: 'full',
  numbered: 'full',
  comparison: 'full',
  do_dont: 'full',
  code: 'full',
  terminal: 'full',
  example: 'full',
  table: 'full',
  file_tree: 'full',
  transcript: 'full',
  timeline: 'full',
  itinerary: 'full',
  step: 'full',
  ingredient: 'full',
  exercise: 'full',
  workout_timer: 'full',
  tool_list: 'full',
  location: 'full',
  quiz: 'full',
  problem_solution: 'full',
  visual: 'full',
  // Promoted from half → full (text-heavy, interrupts reading side-by-side)
  callout: 'full',
  quote: 'full',
  definition: 'full',
  verdict: 'full',

  // Half-width — data-dense, work well side-by-side
  pro_con: 'half',
  cost: 'half',
  nutrition: 'half',
  guest: 'half',
  formula: 'half',
  rating: 'half',

  // Compact — small data points, 2-3 across
  statistic: 'compact',
  keyvalue: 'compact',
  timestamp: 'compact',
};

/** Returns the layout size for a block type. Defaults to 'full' for unknown types. */
export function getBlockSize(type: ContentBlockType): BlockSize {
  const size = BLOCK_SIZE_MAP[type];
  if (!size && import.meta.env.DEV) {
    console.warn(`[block-layout] Unknown block type "${type}", defaulting to full-width`);
  }
  return size ?? 'full';
}

/**
 * Groups consecutive blocks by their layout size.
 * O(n) linear scan, streaming-safe (re-runs produce same groups
 * for the stable prefix of the array).
 *
 * Single orphan handling: a lone half/compact block renders full-width.
 */
export function groupBlocksBySize(blocks: ContentBlock[]): BlockGroup[] {
  if (blocks.length === 0) return [];

  const groups: BlockGroup[] = [];
  let currentSize: BlockSize | null = null;
  let currentBlocks: ContentBlock[] = [];

  for (const block of blocks) {
    const size = getBlockSize(block.type);

    if (size === currentSize) {
      currentBlocks.push(block);
    } else {
      if (currentBlocks.length > 0 && currentSize !== null) {
        groups.push({ size: currentSize, blocks: currentBlocks });
      }
      currentSize = size;
      currentBlocks = [block];
    }
  }

  // Flush remaining
  if (currentBlocks.length > 0 && currentSize !== null) {
    groups.push({ size: currentSize, blocks: currentBlocks });
  }

  return groups;
}

// ─────────────────────────────────────────────────────
// Progressive Spacing System (Phase 2)
// ─────────────────────────────────────────────────────

export type SpacingCategory = 'prose' | 'list' | 'visual' | 'dense';

/** Maps each block type to a spacing category for rhythm calculation. */
const SPACING_CATEGORY_MAP: Record<ContentBlockType, SpacingCategory> = {
  // Prose — flowing text
  paragraph: 'prose',

  // List — bullet/numbered/definition content
  bullets: 'list',
  numbered: 'list',
  do_dont: 'list',
  definition: 'list',
  tool_list: 'list',
  step: 'list',
  ingredient: 'list',

  // Visual — large, distinct blocks that need breathing room
  code: 'visual',
  terminal: 'visual',
  file_tree: 'visual',
  comparison: 'visual',
  example: 'visual',
  table: 'visual',
  timeline: 'visual',
  itinerary: 'visual',
  exercise: 'visual',
  workout_timer: 'visual',
  location: 'visual',
  quiz: 'visual',
  transcript: 'visual',
  problem_solution: 'visual',
  visual: 'visual',

  // Dense — compact data blocks (tighter spacing between them)
  callout: 'dense',
  quote: 'dense',
  statistic: 'dense',
  keyvalue: 'dense',
  timestamp: 'dense',
  rating: 'dense',
  verdict: 'dense',
  pro_con: 'dense',
  cost: 'dense',
  nutrition: 'dense',
  guest: 'dense',
  formula: 'dense',
};

/** Returns the spacing category for a block type. */
export function getSpacingCategory(type: ContentBlockType): SpacingCategory {
  return SPACING_CATEGORY_MAP[type] ?? 'visual';
}

/**
 * Spacing matrix — Tailwind margin-top classes.
 * Determines gap between consecutive blocks based on
 * previous and current block categories.
 *
 * Tighter spacing (~40% reduction from original):
 * | prev\curr | prose  | list   | visual | dense  |
 * |-----------|--------|--------|--------|--------|
 * | prose     | mt-1.5 | mt-2   | mt-3   | mt-2   |
 * | list      | mt-2   | mt-2   | mt-3   | mt-2   |
 * | visual    | mt-3   | mt-3   | mt-2.5 | mt-2.5 |
 * | dense     | mt-2   | mt-2   | mt-2.5 | mt-1.5 |
 */
const SPACING_MATRIX: Record<SpacingCategory, Record<SpacingCategory, string>> = {
  prose:  { prose: 'mt-1.5', list: 'mt-2',   visual: 'mt-3',   dense: 'mt-2' },
  list:   { prose: 'mt-2',   list: 'mt-2',   visual: 'mt-3',   dense: 'mt-2' },
  visual: { prose: 'mt-3',   list: 'mt-3',   visual: 'mt-2.5', dense: 'mt-2.5' },
  dense:  { prose: 'mt-2',   list: 'mt-2',   visual: 'mt-2.5', dense: 'mt-1.5' },
};

/**
 * Returns the Tailwind margin-top class for spacing between two blocks.
 * Returns empty string if prevType is null (first block).
 */
export function getBlockSpacing(prevType: ContentBlockType | null, currentType: ContentBlockType): string {
  if (prevType === null) return '';
  const prevCat = getSpacingCategory(prevType);
  const currCat = getSpacingCategory(currentType);
  return SPACING_MATRIX[prevCat][currCat];
}

/**
 * Pre-computes spacing classes for each block across grouped layout.
 * Returns a Map from block → Tailwind margin-top class.
 *
 * Grid groups get spacing on the container (keyed to first block).
 * Full-width groups get spacing per individual block.
 */
export function computeSpacingMap(
  groups: BlockGroup[],
  gridClasses: Record<BlockGroup['size'], string>,
): Map<ContentBlock, string> {
  const map = new Map<ContentBlock, string>();
  let prev: ContentBlockType | null = null;

  for (const group of groups) {
    const isSingleOrphan = group.blocks.length === 1 && group.size !== 'full';
    const hasGrid = !isSingleOrphan && gridClasses[group.size] !== '';

    if (hasGrid) {
      // Grid group: spacing on container from first block
      map.set(group.blocks[0], getBlockSpacing(prev, group.blocks[0].type));
      prev = group.blocks[group.blocks.length - 1].type;
    } else {
      // Full-width or single orphan: spacing per block
      for (const block of group.blocks) {
        map.set(block, getBlockSpacing(prev, block.type));
        prev = block.type;
      }
    }
  }

  return map;
}

// ─────────────────────────────────────────────────────
// Sidebar Classification (Phase 3)
// ─────────────────────────────────────────────────────

/**
 * Block types that render well in a narrow sidebar column (~280px).
 * These are data-dense, compact blocks that don't need full width.
 *
 * NOTE: This is separate from BLOCK_SIZE_MAP above. BLOCK_SIZE_MAP controls
 * the auto-grid in ContentBlocks (full/half/compact columns). This set controls
 * which blocks can be placed in a ViewLayout sidebar (~280px). Some types like
 * `ingredient` and `tool_list` are `full` in the grid (they shouldn't share a
 * row with other blocks) but work well in a dedicated sidebar column.
 */
export const SIDEBAR_COMPATIBLE_TYPES: Set<ContentBlockType> = new Set([
  'rating',
  'nutrition',
  'cost',
  'keyvalue',
  'statistic',
  'ingredient',
  'tool_list',
  'guest',
  'timestamp',
  'formula',
]);

