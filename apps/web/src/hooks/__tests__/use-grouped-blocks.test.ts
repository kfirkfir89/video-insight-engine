import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGroupedBlocks, type BlockGroupRule } from '../use-grouped-blocks';
import type { ContentBlock } from '@vie/types';

function makeBlock(overrides: Partial<ContentBlock>): ContentBlock {
  return { type: 'paragraph', blockId: 'b-1', ...overrides } as ContentBlock;
}

const RULES: readonly BlockGroupRule[] = [
  { name: 'definitions', match: (b) => b.type === 'definition' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

describe('useGroupedBlocks', () => {
  describe('grouping', () => {
    it('should group blocks by matching rules', () => {
      const blocks: ContentBlock[] = [
        makeBlock({ type: 'definition', blockId: 'b-1' }),
        makeBlock({ type: 'timestamp', blockId: 'b-2' }),
        makeBlock({ type: 'paragraph', blockId: 'b-3' }),
      ];

      const { result } = renderHook(() => useGroupedBlocks(blocks, RULES));

      expect(result.current.definitions).toHaveLength(1);
      expect(result.current.timestamps).toHaveLength(1);
      expect(result.current.other).toHaveLength(1);
    });

    it('should put unmatched blocks in other', () => {
      const blocks: ContentBlock[] = [
        makeBlock({ type: 'paragraph', blockId: 'b-1' }),
        makeBlock({ type: 'bullets', blockId: 'b-2' }),
      ];

      const { result } = renderHook(() => useGroupedBlocks(blocks, RULES));

      expect(result.current.definitions).toHaveLength(0);
      expect(result.current.timestamps).toHaveLength(0);
      expect(result.current.other).toHaveLength(2);
    });

    it('should use first matching rule when multiple could match', () => {
      const overlappingRules: readonly BlockGroupRule[] = [
        { name: 'allBullets', match: (b) => b.type === 'bullets' },
        { name: 'ingredients', match: (b) => b.type === 'bullets' && b.variant === 'ingredients' },
      ];

      const blocks: ContentBlock[] = [
        makeBlock({ type: 'bullets', variant: 'ingredients', blockId: 'b-1' }),
      ];

      const { result } = renderHook(() => useGroupedBlocks(blocks, overlappingRules));

      expect(result.current.allBullets).toHaveLength(1);
      expect(result.current.ingredients).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined blocks', () => {
      const { result } = renderHook(() => useGroupedBlocks(undefined, RULES));

      expect(result.current.definitions).toHaveLength(0);
      expect(result.current.timestamps).toHaveLength(0);
      expect(result.current.other).toHaveLength(0);
    });

    it('should handle empty blocks array', () => {
      const { result } = renderHook(() => useGroupedBlocks([], RULES));

      expect(result.current.definitions).toHaveLength(0);
      expect(result.current.other).toHaveLength(0);
    });

    it('should handle empty rules — all blocks go to other', () => {
      const blocks: ContentBlock[] = [
        makeBlock({ type: 'paragraph', blockId: 'b-1' }),
      ];

      const { result } = renderHook(() => useGroupedBlocks(blocks, []));

      expect(result.current.other).toHaveLength(1);
    });
  });

  describe('memoization', () => {
    it('should return same reference when inputs are stable', () => {
      const blocks: ContentBlock[] = [makeBlock({ type: 'paragraph', blockId: 'b-1' })];

      const { result, rerender } = renderHook(() => useGroupedBlocks(blocks, RULES));
      const first = result.current;

      rerender();
      expect(result.current).toBe(first);
    });

    it('should return new reference when blocks array reference changes', () => {
      const blocksA: ContentBlock[] = [makeBlock({ type: 'paragraph', blockId: 'b-1' })];
      const blocksB: ContentBlock[] = [makeBlock({ type: 'paragraph', blockId: 'b-1' })];

      const { result, rerender } = renderHook(
        ({ blocks }) => useGroupedBlocks(blocks, RULES),
        { initialProps: { blocks: blocksA } }
      );
      const first = result.current;

      rerender({ blocks: blocksB });
      expect(result.current).not.toBe(first);
    });
  });
});
