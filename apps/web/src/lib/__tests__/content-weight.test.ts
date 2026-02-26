import { describe, it, expect } from 'vitest';
import { measureBlock, measureBlocks, getTypeFallbackWeight } from '../content-weight';
import type { ContentBlock } from '@vie/types';

function block<T extends ContentBlock>(data: T): T {
  return { blockId: 'test', ...data };
}

describe('measureBlock', () => {
  describe('paragraph', () => {
    it('should return micro for very short text (<80 chars)', () => {
      const result = measureBlock(block({ type: 'paragraph', blockId: 't', text: 'Short text.' }));
      expect(result.weight).toBe('micro');
      expect(result.spans).toBe(1);
    });

    it('should return compact for medium text (<200 chars)', () => {
      const result = measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(150) }));
      expect(result.weight).toBe('compact');
      expect(result.spans).toBe(2);
    });

    it('should return standard for normal text (<500 chars)', () => {
      const result = measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(350) }));
      expect(result.weight).toBe('standard');
      expect(result.spans).toBe(4);
    });

    it('should return expanded for long text (500+ chars)', () => {
      const result = measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(600) }));
      expect(result.weight).toBe('expanded');
      expect(result.spans).toBe(4);
    });

    it('should handle boundary at 80 chars', () => {
      expect(measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(79) })).weight).toBe('micro');
      expect(measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(80) })).weight).toBe('compact');
    });
  });

  describe('bullets/numbered', () => {
    it('should return compact for 1-2 items', () => {
      expect(measureBlock(block({ type: 'bullets', blockId: 't', items: ['a', 'b'] })).weight).toBe('compact');
      expect(measureBlock(block({ type: 'numbered', blockId: 't', items: ['a'] })).weight).toBe('compact');
    });

    it('should return standard for 3-5 items', () => {
      expect(measureBlock(block({ type: 'bullets', blockId: 't', items: ['a', 'b', 'c', 'd'] })).weight).toBe('standard');
    });

    it('should return expanded for 6+ items', () => {
      const items = Array.from({ length: 8 }, (_, i) => `item ${i}`);
      expect(measureBlock(block({ type: 'numbered', blockId: 't', items })).weight).toBe('expanded');
    });
  });

  describe('statistic', () => {
    it('should return micro for single stat', () => {
      const result = measureBlock(block({
        type: 'statistic', blockId: 't',
        items: [{ value: '85%', label: 'Score' }],
      }));
      expect(result.weight).toBe('micro');
      expect(result.spans).toBe(1);
    });

    it('should return compact for 2-3 stats', () => {
      const result = measureBlock(block({
        type: 'statistic', blockId: 't',
        items: [
          { value: '85%', label: 'Score' },
          { value: '120', label: 'Count' },
        ],
      }));
      expect(result.weight).toBe('compact');
    });

    it('should return standard for 4+ stats', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ value: `${i}`, label: `Stat ${i}` }));
      expect(measureBlock(block({ type: 'statistic', blockId: 't', items })).weight).toBe('standard');
    });
  });

  describe('callout', () => {
    it('should return compact for short callout', () => {
      expect(measureBlock(block({ type: 'callout', blockId: 't', style: 'tip', text: 'Short tip.' })).weight).toBe('compact');
    });

    it('should return standard for long callout', () => {
      expect(measureBlock(block({ type: 'callout', blockId: 't', style: 'tip', text: 'A'.repeat(150) })).weight).toBe('standard');
    });
  });

  describe('quote', () => {
    it('should return compact for short quote', () => {
      expect(measureBlock(block({ type: 'quote', blockId: 't', text: 'Be the change.' })).weight).toBe('compact');
    });

    it('should return standard for long quote', () => {
      expect(measureBlock(block({ type: 'quote', blockId: 't', text: 'A'.repeat(120) })).weight).toBe('standard');
    });
  });

  describe('code', () => {
    it('should return compact for <5 lines', () => {
      expect(measureBlock(block({ type: 'code', blockId: 't', code: 'a\nb\nc' })).weight).toBe('compact');
    });

    it('should return standard for 5-15 lines', () => {
      const code = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n');
      expect(measureBlock(block({ type: 'code', blockId: 't', code })).weight).toBe('standard');
    });

    it('should return expanded for 15+ lines', () => {
      const code = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
      expect(measureBlock(block({ type: 'code', blockId: 't', code })).weight).toBe('expanded');
    });
  });

  describe('keyvalue', () => {
    it('should return compact for 1-3 items', () => {
      const items = [{ key: 'a', value: '1' }, { key: 'b', value: '2' }];
      expect(measureBlock(block({ type: 'keyvalue', blockId: 't', items })).weight).toBe('compact');
    });

    it('should return standard for 4+ items', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, value: `v${i}` }));
      expect(measureBlock(block({ type: 'keyvalue', blockId: 't', items })).weight).toBe('standard');
    });
  });

  describe('timestamp', () => {
    it('should always return micro', () => {
      expect(measureBlock(block({ type: 'timestamp', blockId: 't', time: '5:23', seconds: 323, label: 'Chapter' })).weight).toBe('micro');
    });
  });

  describe('rating', () => {
    it('should return compact without detailed breakdown', () => {
      expect(measureBlock(block({ type: 'rating', blockId: 't', score: 8, maxScore: 10 })).weight).toBe('compact');
    });

    it('should return standard with 4+ breakdown categories', () => {
      const breakdown = Array.from({ length: 5 }, (_, i) => ({ category: `Cat ${i}`, score: i }));
      expect(measureBlock(block({ type: 'rating', blockId: 't', score: 8, maxScore: 10, breakdown })).weight).toBe('standard');
    });
  });

  describe('comparison', () => {
    it('should return standard for small comparisons', () => {
      expect(measureBlock(block({
        type: 'comparison', blockId: 't',
        left: { label: 'A', items: ['x', 'y'] },
        right: { label: 'B', items: ['x', 'y'] },
      })).weight).toBe('standard');
    });

    it('should return expanded for large comparisons', () => {
      const items = Array.from({ length: 5 }, (_, i) => `item ${i}`);
      expect(measureBlock(block({
        type: 'comparison', blockId: 't',
        left: { label: 'A', items },
        right: { label: 'B', items },
      })).weight).toBe('expanded');
    });
  });

  describe('ingredient', () => {
    it('should return compact for 5 or fewer items', () => {
      const items = Array.from({ length: 4 }, (_, i) => ({ name: `item ${i}` }));
      expect(measureBlock(block({ type: 'ingredient', blockId: 't', items })).weight).toBe('compact');
    });

    it('should return standard for 6-10 items', () => {
      const items = Array.from({ length: 8 }, (_, i) => ({ name: `item ${i}` }));
      expect(measureBlock(block({ type: 'ingredient', blockId: 't', items })).weight).toBe('standard');
    });
  });

  describe('pro_con', () => {
    it('should return compact for small pros/cons', () => {
      expect(measureBlock(block({ type: 'pro_con', blockId: 't', pros: ['a'], cons: ['b'] })).weight).toBe('compact');
    });

    it('should return standard for medium pros/cons', () => {
      expect(measureBlock(block({ type: 'pro_con', blockId: 't', pros: ['a', 'b', 'c'], cons: ['d', 'e'] })).weight).toBe('standard');
    });
  });

  describe('definition', () => {
    it('should return compact for short definition', () => {
      expect(measureBlock(block({ type: 'definition', blockId: 't', term: 'API', meaning: 'An interface.' })).weight).toBe('compact');
    });

    it('should return standard for long definition (150+ chars total)', () => {
      expect(measureBlock(block({ type: 'definition', blockId: 't', term: 'A'.repeat(50), meaning: 'B'.repeat(101) })).weight).toBe('standard');
    });

    it('should handle boundary at 150 chars total', () => {
      expect(measureBlock(block({ type: 'definition', blockId: 't', term: 'A'.repeat(50), meaning: 'B'.repeat(99) })).weight).toBe('compact');
      expect(measureBlock(block({ type: 'definition', blockId: 't', term: 'A'.repeat(50), meaning: 'B'.repeat(100) })).weight).toBe('standard');
    });
  });

  describe('do_dont', () => {
    it('should return compact for small lists', () => {
      expect(measureBlock(block({ type: 'do_dont', blockId: 't', do: ['a'], dont: ['b'] })).weight).toBe('compact');
    });

    it('should return expanded for large lists', () => {
      const items = Array.from({ length: 6 }, (_, i) => `item ${i}`);
      expect(measureBlock(block({ type: 'do_dont', blockId: 't', do: items, dont: items })).weight).toBe('expanded');
    });
  });

  describe('problem_solution', () => {
    it('should return compact for short problem/solution (<150 total)', () => {
      expect(measureBlock(block({
        type: 'problem_solution', blockId: 't',
        problem: 'Short', solution: 'Fix',
      })).weight).toBe('compact');
    });

    it('should return standard for longer problem/solution (150+ total)', () => {
      expect(measureBlock(block({
        type: 'problem_solution', blockId: 't',
        problem: 'A'.repeat(80), solution: 'B'.repeat(80),
      })).weight).toBe('standard');
    });

    it('should include context in total length', () => {
      expect(measureBlock(block({
        type: 'problem_solution', blockId: 't',
        problem: 'A'.repeat(50), solution: 'B'.repeat(50), context: 'C'.repeat(50),
      })).weight).toBe('standard');
    });

    it('should handle boundary at 150 total chars', () => {
      expect(measureBlock(block({
        type: 'problem_solution', blockId: 't',
        problem: 'A'.repeat(74), solution: 'B'.repeat(75),
      })).weight).toBe('compact');
      expect(measureBlock(block({
        type: 'problem_solution', blockId: 't',
        problem: 'A'.repeat(75), solution: 'B'.repeat(75),
      })).weight).toBe('standard');
    });
  });

  describe('visual', () => {
    it('should return compact without imageUrl', () => {
      expect(measureBlock(block({
        type: 'visual', blockId: 't',
        description: 'Architecture diagram',
      })).weight).toBe('compact');
    });

    it('should return standard with imageUrl', () => {
      expect(measureBlock(block({
        type: 'visual', blockId: 't',
        description: 'Diagram', imageUrl: 'https://example.com/img.jpg',
      })).weight).toBe('standard');
    });

    it('should return compact with variant but no imageUrl', () => {
      expect(measureBlock(block({
        type: 'visual', blockId: 't',
        description: 'Diagram', variant: 'diagram', timestamp: 125,
      })).weight).toBe('compact');
    });
  });

  describe('paragraph boundary values', () => {
    it('should handle boundary at 200 chars', () => {
      expect(measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(199) })).weight).toBe('compact');
      expect(measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(200) })).weight).toBe('standard');
    });

    it('should handle boundary at 500 chars', () => {
      expect(measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(499) })).weight).toBe('standard');
      expect(measureBlock(block({ type: 'paragraph', blockId: 't', text: 'A'.repeat(500) })).weight).toBe('expanded');
    });
  });

  describe('callout boundary', () => {
    it('should handle boundary at 120 chars', () => {
      expect(measureBlock(block({ type: 'callout', blockId: 't', style: 'tip', text: 'A'.repeat(119) })).weight).toBe('compact');
      expect(measureBlock(block({ type: 'callout', blockId: 't', style: 'tip', text: 'A'.repeat(120) })).weight).toBe('standard');
    });
  });

  describe('quote boundary', () => {
    it('should handle boundary at 100 chars', () => {
      expect(measureBlock(block({ type: 'quote', blockId: 't', text: 'A'.repeat(99) })).weight).toBe('compact');
      expect(measureBlock(block({ type: 'quote', blockId: 't', text: 'A'.repeat(100) })).weight).toBe('standard');
    });
  });
});

describe('measureBlocks', () => {
  it('should return a map for all blocks', () => {
    const blocks: ContentBlock[] = [
      block({ type: 'paragraph', blockId: '1', text: 'Hello' }),
      block({ type: 'timestamp', blockId: '2', time: '0:00', seconds: 0, label: 'Start' }),
    ];
    const map = measureBlocks(blocks);

    expect(map.size).toBe(2);
    expect(map.get(blocks[0].blockId)?.weight).toBe('micro');
    expect(map.get(blocks[1].blockId)?.weight).toBe('micro');
  });
});

describe('getTypeFallbackWeight', () => {
  it('should return micro for timestamp', () => {
    expect(getTypeFallbackWeight('timestamp')).toBe('micro');
  });

  it('should return compact for statistic', () => {
    expect(getTypeFallbackWeight('statistic')).toBe('compact');
  });

  it('should return standard for unknown types', () => {
    expect(getTypeFallbackWeight('paragraph')).toBe('standard');
    expect(getTypeFallbackWeight('code')).toBe('standard');
  });
});
