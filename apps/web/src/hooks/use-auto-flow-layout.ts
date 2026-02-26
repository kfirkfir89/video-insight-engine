import { useMemo } from 'react';
import type { ContentBlock } from '@vie/types';
import { computeAutoFlowLayout, type FlowRow } from '@/lib/auto-flow-layout';
import type { BlockMeasurement } from '@/lib/content-weight';

/**
 * Memoized wrapper for computeAutoFlowLayout.
 * Returns a stable FlowRow[] that only recomputes when blocks or measurements change.
 * Accepts optional measurements for content-aware layout; falls back to type-based.
 */
export function useAutoFlowLayout(
  blocks: ContentBlock[],
  measurements?: Map<string, BlockMeasurement>,
): FlowRow[] {
  return useMemo(
    () => computeAutoFlowLayout(blocks, measurements),
    [blocks, measurements],
  );
}
