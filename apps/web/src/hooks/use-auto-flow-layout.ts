import { useMemo } from 'react';
import type { ContentBlock } from '@vie/types';
import { computeAutoFlowLayout, type FlowRow } from '@/lib/auto-flow-layout';

/**
 * Memoized wrapper for computeAutoFlowLayout.
 * Returns a stable FlowRow[] that only recomputes when blocks change.
 */
export function useAutoFlowLayout(blocks: ContentBlock[]): FlowRow[] {
  return useMemo(() => computeAutoFlowLayout(blocks), [blocks]);
}
