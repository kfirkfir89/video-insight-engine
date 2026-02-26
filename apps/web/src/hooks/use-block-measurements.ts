import { useMemo } from 'react';
import type { ContentBlock } from '@vie/types';
import { measureBlocks, type BlockMeasurement } from '@/lib/content-weight';

/**
 * Memoized hook that measures content weight for an array of blocks.
 * Returns a stable Map<string, BlockMeasurement> keyed by blockId that only
 * recomputes when the blocks array reference changes.
 *
 * Uses blockId (string) as Map key instead of object references, so lookups
 * work correctly even when block objects are recreated with the same data.
 */
export function useBlockMeasurements(blocks: ContentBlock[]): Map<string, BlockMeasurement> {
  return useMemo(() => measureBlocks(blocks), [blocks]);
}
