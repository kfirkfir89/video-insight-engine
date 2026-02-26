import { describe, it, expect } from 'vitest';
import { computeAutoFlowLayout } from '../auto-flow-layout';
import { measureBlock, type BlockMeasurement } from '../content-weight';
import type { ContentBlock } from '@vie/types';

function block(type: ContentBlock['type'], overrides?: Partial<ContentBlock>): ContentBlock {
  return { type, blockId: `test-${type}`, ...overrides } as ContentBlock;
}

/** Create a measurement map for blocks (keyed by blockId) */
function measure(blocks: ContentBlock[]): Map<string, BlockMeasurement> {
  const map = new Map<string, BlockMeasurement>();
  for (const b of blocks) {
    map.set(b.blockId, measureBlock(b));
  }
  return map;
}

describe('computeAutoFlowLayout', () => {
  describe('backward compatibility (no measurements)', () => {
    it('should return empty array for empty input', () => {
      expect(computeAutoFlowLayout([])).toEqual([]);
    });

    it('should render single full-width block as full row', () => {
      const rows = computeAutoFlowLayout([block('paragraph')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('full');
      expect(rows[0].columns).toHaveLength(1);
      expect(rows[0].columns[0][0].type).toBe('paragraph');
    });

    it('should pair sidebar-compatible + full-width as sidebar-main', () => {
      const rows = computeAutoFlowLayout([block('rating'), block('paragraph')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('sidebar-main');
      expect(rows[0].columns[0][0].type).toBe('rating');
      expect(rows[0].columns[1][0].type).toBe('paragraph');
    });

    it('should pair full-width + sidebar-compatible as sidebar-main (reversed)', () => {
      const rows = computeAutoFlowLayout([block('paragraph'), block('rating')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('sidebar-main');
      expect(rows[0].columns[0][0].type).toBe('rating');
      expect(rows[0].columns[1][0].type).toBe('paragraph');
    });

    it('should pair consecutive sidebar-compatible blocks as equal-2', () => {
      const rows = computeAutoFlowLayout([block('rating'), block('cost')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('equal-2');
      expect(rows[0].columns[0][0].type).toBe('rating');
      expect(rows[0].columns[1][0].type).toBe('cost');
    });

    it('should handle complementary pair: verdict + rating', () => {
      const rows = computeAutoFlowLayout([block('verdict'), block('rating')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('sidebar-main');
      expect(rows[0].columns[0][0].type).toBe('rating');
      expect(rows[0].columns[1][0].type).toBe('verdict');
    });

    it('should handle complementary pair: cost + nutrition', () => {
      const rows = computeAutoFlowLayout([block('cost'), block('nutrition')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('equal-2');
    });

    it('should handle complementary pair: guest + quote', () => {
      const rows = computeAutoFlowLayout([block('guest'), block('quote')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('sidebar-main');
    });

    it('should handle reverse complementary pair: rating + verdict', () => {
      const rows = computeAutoFlowLayout([block('rating'), block('verdict')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('sidebar-main');
      expect(rows[0].columns[0][0].type).toBe('rating');
      expect(rows[0].columns[1][0].type).toBe('verdict');
    });

    it('should handle reverse complementary pair: nutrition + cost', () => {
      const rows = computeAutoFlowLayout([block('nutrition'), block('cost')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('equal-2');
    });

    it('should handle reverse complementary pair: quote + guest', () => {
      const rows = computeAutoFlowLayout([block('quote'), block('guest')]);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('sidebar-main');
      expect(rows[0].columns[0][0].type).toBe('guest');
      expect(rows[0].columns[1][0].type).toBe('quote');
    });

    it('should group 3 consecutive sidebar-compatible blocks as equal-3', () => {
      const rows = computeAutoFlowLayout([
        block('rating'),
        block('cost'),
        block('nutrition'),
      ]);

      // 3 compact sidebar blocks → equal-3 (enhanced behavior)
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('equal-3');
      expect(rows[0].columns).toHaveLength(3);
    });

    it('should group 3 sidebar blocks as equal-3 then full-width separately', () => {
      const rows = computeAutoFlowLayout([
        block('rating'),
        block('cost'),
        block('nutrition'),
        block('paragraph'),
      ]);

      // 3 compact → equal-3, paragraph → full
      expect(rows).toHaveLength(2);
      expect(rows[0].type).toBe('equal-3');
      expect(rows[1].type).toBe('full');
    });

    it('should handle all full-width blocks', () => {
      const rows = computeAutoFlowLayout([
        block('paragraph'),
        block('code'),
        block('table'),
      ]);

      expect(rows.every(r => r.type === 'full')).toBe(true);
    });

    it('should handle mixed sequence', () => {
      const rows = computeAutoFlowLayout([
        block('paragraph'),
        block('rating'),
        block('code'),
        block('cost'),
        block('nutrition'),
        block('table'),
      ]);

      expect(rows[0].type).toBe('sidebar-main');
      expect(rows[1].type).toBe('sidebar-main');
      expect(rows[2].type).toBe('sidebar-main');
      expect(rows).toHaveLength(3);
    });

    it('should preserve all blocks in output', () => {
      const input = [
        block('paragraph'),
        block('rating'),
        block('code'),
        block('cost'),
        block('nutrition'),
      ];
      const rows = computeAutoFlowLayout(input);

      const outputBlocks = rows.flatMap(r => r.columns.flat());
      expect(outputBlocks).toHaveLength(input.length);
    });
  });

  describe('content-aware layout (with measurements)', () => {
    it('should render expanded blocks as full row', () => {
      const blocks = [
        { type: 'paragraph', blockId: '1', text: 'A'.repeat(600) } as ContentBlock,
      ];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('full');
    });

    it('should group 4+ consecutive micro blocks as equal-4', () => {
      const blocks = [
        { type: 'timestamp', blockId: '1', time: '0:00', seconds: 0, label: 'A' } as ContentBlock,
        { type: 'timestamp', blockId: '2', time: '1:00', seconds: 60, label: 'B' } as ContentBlock,
        { type: 'timestamp', blockId: '3', time: '2:00', seconds: 120, label: 'C' } as ContentBlock,
        { type: 'timestamp', blockId: '4', time: '3:00', seconds: 180, label: 'D' } as ContentBlock,
      ];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('equal-4');
      expect(rows[0].columns).toHaveLength(4);
    });

    it('should group 3 consecutive compact blocks as equal-3', () => {
      const blocks = [
        { type: 'statistic', blockId: '1', items: [{ value: '10', label: 'A' }, { value: '20', label: 'B' }] } as ContentBlock,
        { type: 'keyvalue', blockId: '2', items: [{ key: 'a', value: '1' }] } as ContentBlock,
        { type: 'cost', blockId: '3', items: [{ category: 'a', amount: 10 }] } as ContentBlock,
      ];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('equal-3');
      expect(rows[0].columns).toHaveLength(3);
    });

    it('should not pair expanded block with sidebar', () => {
      const blocks = [
        { type: 'code', blockId: '1', code: Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n') } as ContentBlock,
        { type: 'rating', blockId: '2', score: 8, maxScore: 10 } as ContentBlock,
      ];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      // Expanded code goes full, rating follows
      expect(rows[0].type).toBe('full');
      expect(rows[0].columns[0][0].type).toBe('code');
    });

    it('should preserve block count with measurements', () => {
      const blocks = [
        { type: 'paragraph', blockId: '1', text: 'Short' } as ContentBlock,
        { type: 'statistic', blockId: '2', items: [{ value: '5', label: 'X' }] } as ContentBlock,
        { type: 'keyvalue', blockId: '3', items: [{ key: 'a', value: '1' }, { key: 'b', value: '2' }] } as ContentBlock,
        { type: 'rating', blockId: '4', score: 9, maxScore: 10 } as ContentBlock,
        { type: 'code', blockId: '5', code: 'console.log("hi")' } as ContentBlock,
      ];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));
      const outputBlocks = rows.flatMap(r => r.columns.flat());
      expect(outputBlocks).toHaveLength(blocks.length);
    });

    it('should batch 5 micro blocks as equal-4 + 1 falls through', () => {
      const blocks = Array.from({ length: 5 }, (_, i) => ({
        type: 'timestamp', blockId: `${i}`, time: `${i}:00`, seconds: i * 60, label: String.fromCharCode(65 + i),
      })) as ContentBlock[];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));
      const outputBlocks = rows.flatMap(r => r.columns.flat());

      expect(rows[0].type).toBe('equal-4');
      expect(rows[0].columns).toHaveLength(4);
      expect(outputBlocks).toHaveLength(5);
    });

    it('should batch 6 micro blocks as equal-4 + equal-2', () => {
      const blocks = Array.from({ length: 6 }, (_, i) => ({
        type: 'timestamp', blockId: `${i}`, time: `${i}:00`, seconds: i * 60, label: String.fromCharCode(65 + i),
      })) as ContentBlock[];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      expect(rows[0].type).toBe('equal-4');
      expect(rows[1].type).toBe('equal-2');
      const outputBlocks = rows.flatMap(r => r.columns.flat());
      expect(outputBlocks).toHaveLength(6);
    });

    it('should batch 7 micro blocks as equal-4 + equal-3', () => {
      const blocks = Array.from({ length: 7 }, (_, i) => ({
        type: 'timestamp', blockId: `${i}`, time: `${i}:00`, seconds: i * 60, label: String.fromCharCode(65 + i),
      })) as ContentBlock[];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      expect(rows[0].type).toBe('equal-4');
      expect(rows[1].type).toBe('equal-3');
      const outputBlocks = rows.flatMap(r => r.columns.flat());
      expect(outputBlocks).toHaveLength(7);
    });

    it('should batch 8 micro blocks as equal-4 + equal-4', () => {
      const blocks = Array.from({ length: 8 }, (_, i) => ({
        type: 'timestamp', blockId: `${i}`, time: `${i}:00`, seconds: i * 60, label: String.fromCharCode(65 + i),
      })) as ContentBlock[];
      const rows = computeAutoFlowLayout(blocks, measure(blocks));

      expect(rows).toHaveLength(2);
      expect(rows[0].type).toBe('equal-4');
      expect(rows[1].type).toBe('equal-4');
      const outputBlocks = rows.flatMap(r => r.columns.flat());
      expect(outputBlocks).toHaveLength(8);
    });
  });
});
