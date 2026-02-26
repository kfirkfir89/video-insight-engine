import type { ContentBlock, ContentBlockType } from '@vie/types';

// ─────────────────────────────────────────────────────
// Content Weight System
// Measures block content at runtime for intelligent layout
// ─────────────────────────────────────────────────────

/**
 * Content weight determines how many grid spans a block occupies.
 * - micro: 1 span — single stat, short key-value, timestamp chip
 * - compact: 2 spans — short paragraph, callout, 1-2 item list
 * - standard: 4 spans — normal paragraph, 3-5 item list, code block
 * - expanded: 4 spans (full) — long paragraph, 6+ item list, large code
 */
export type ContentWeight = 'micro' | 'compact' | 'standard' | 'expanded';

export interface BlockMeasurement {
  weight: ContentWeight;
  /** Grid span count (1, 2, or 4) */
  spans: number;
}

const WEIGHT_SPANS: Record<ContentWeight, number> = {
  micro: 1,
  compact: 2,
  standard: 4,
  expanded: 4,
};

/**
 * Measures a block's content weight based on its type and data.
 * O(1) per block — uses string length and array counts, no DOM measurement.
 */
export function measureBlock(block: ContentBlock): BlockMeasurement {
  const weight = measureWeight(block);
  return { weight, spans: WEIGHT_SPANS[weight] };
}

function measureWeight(block: ContentBlock): ContentWeight {
  switch (block.type) {
    // ── Text blocks ──
    case 'paragraph': {
      const len = block.text.length;
      if (len < 80) return 'micro';
      if (len < 200) return 'compact';
      if (len < 500) return 'standard';
      return 'expanded';
    }

    // ── List blocks ──
    case 'bullets':
    case 'numbered': {
      const count = block.items.length;
      if (count <= 2) return 'compact';
      if (count <= 5) return 'standard';
      return 'expanded';
    }

    case 'do_dont': {
      const total = block.do.length + block.dont.length;
      if (total <= 4) return 'compact';
      if (total <= 8) return 'standard';
      return 'expanded';
    }

    // ── Callout / Quote / Definition ──
    case 'callout':
      return block.text.length < 120 ? 'compact' : 'standard';

    case 'quote':
      return block.text.length < 100 ? 'compact' : 'standard';

    case 'definition':
      return (block.term.length + block.meaning.length) < 150 ? 'compact' : 'standard';

    // ── Data blocks ──
    case 'statistic': {
      const count = block.items.length;
      if (count === 1) return 'micro';
      if (count <= 3) return 'compact';
      return 'standard';
    }

    case 'keyvalue': {
      const count = block.items.length;
      if (count <= 3) return 'compact';
      return 'standard';
    }

    case 'timestamp':
      return 'micro';

    case 'rating':
      return block.breakdown && block.breakdown.length > 3 ? 'standard' : 'compact';

    case 'verdict':
      return block.summary.length < 150 ? 'compact' : 'standard';

    // ── Code blocks ──
    case 'code': {
      const lines = block.code.split('\n').length;
      if (lines < 5) return 'compact';
      if (lines <= 15) return 'standard';
      return 'expanded';
    }

    case 'terminal':
      return block.output && block.output.split('\n').length > 5 ? 'standard' : 'compact';

    case 'example':
      return block.code.split('\n').length > 10 ? 'expanded' : 'standard';

    case 'file_tree':
      return 'standard';

    // ── Comparison / Table ──
    case 'comparison': {
      const total = block.left.items.length + block.right.items.length;
      if (total <= 6) return 'standard';
      return 'expanded';
    }

    case 'table': {
      const rows = block.rows.length;
      if (rows <= 3) return 'standard';
      return 'expanded';
    }

    // ── Timeline / Itinerary ──
    case 'timeline': {
      const count = block.events.length;
      if (count <= 3) return 'standard';
      return 'expanded';
    }

    case 'itinerary':
      return 'expanded';

    // ── Category-specific ──
    case 'step': {
      const count = block.steps.length;
      if (count <= 3) return 'standard';
      return 'expanded';
    }

    case 'ingredient': {
      const count = block.items.length;
      if (count <= 5) return 'compact';
      if (count <= 10) return 'standard';
      return 'expanded';
    }

    case 'nutrition': {
      const count = block.items.length;
      if (count <= 4) return 'compact';
      return 'standard';
    }

    case 'cost': {
      const count = block.items.length;
      if (count <= 3) return 'compact';
      return 'standard';
    }

    case 'pro_con': {
      const total = block.pros.length + block.cons.length;
      if (total <= 4) return 'compact';
      if (total <= 8) return 'standard';
      return 'expanded';
    }

    case 'guest': {
      const count = block.guests.length;
      if (count === 1) return 'compact';
      return 'standard';
    }

    case 'formula':
      return block.description ? 'standard' : 'compact';

    case 'exercise': {
      const count = block.exercises.length;
      if (count <= 3) return 'standard';
      return 'expanded';
    }

    case 'workout_timer':
      return 'standard';

    case 'location':
      return 'standard';

    case 'quiz': {
      const count = block.questions.length;
      if (count <= 2) return 'standard';
      return 'expanded';
    }

    case 'transcript': {
      const count = block.lines.length;
      if (count <= 5) return 'standard';
      return 'expanded';
    }

    case 'tool_list': {
      const count = block.tools.length;
      if (count <= 3) return 'compact';
      if (count <= 6) return 'standard';
      return 'expanded';
    }

    case 'problem_solution': {
      const total = block.problem.length + block.solution.length + (block.context?.length ?? 0);
      if (total < 150) return 'compact';
      return 'standard';
    }

    case 'visual': {
      if (block.frames && block.frames.length > 1) return 'expanded';
      return block.imageUrl ? 'standard' : 'compact';
    }

    default: {
      // Exhaustive type check: if a new block type is added to ContentBlock
      // without a case here, TypeScript will error on `const _: never = block`.
      // This ensures content-weight stays in sync with the type union.
      const _: never = block;
      void _;
      if (import.meta.env.DEV) {
        console.warn(`[content-weight] Unknown block type "${(block as ContentBlock).type}"`);
      }
      return 'standard';
    }
  }
}

/**
 * Bulk-measure an array of blocks.
 * Returns a Map keyed by blockId for O(1) lookup independent of object identity.
 */
export function measureBlocks(blocks: ContentBlock[]): Map<string, BlockMeasurement> {
  const map = new Map<string, BlockMeasurement>();
  for (const block of blocks) {
    map.set(block.blockId, measureBlock(block));
  }
  return map;
}

/**
 * Type-based fallback weight for when no content data is available.
 * Used for backward compatibility with the existing layout system.
 */
const TYPE_FALLBACK_WEIGHT: Partial<Record<ContentBlockType, ContentWeight>> = {
  timestamp: 'micro',
  statistic: 'compact',
  keyvalue: 'compact',
  callout: 'compact',
  quote: 'compact',
  rating: 'compact',
  formula: 'compact',
  nutrition: 'compact',
  cost: 'compact',
  guest: 'compact',
};

export function getTypeFallbackWeight(type: ContentBlockType): ContentWeight {
  return TYPE_FALLBACK_WEIGHT[type] ?? 'standard';
}
