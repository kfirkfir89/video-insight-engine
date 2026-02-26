import { describe, it, expect } from 'vitest';
import {
  getBlockSize,
  groupBlocksBySize,
  getSpacingCategory,
  getBlockSpacing,
  computeSpacingMap,
  SIDEBAR_COMPATIBLE_TYPES,
  type BlockGroup,
} from '../block-layout';
import type { ContentBlock } from '@vie/types';

/** Helper to create a minimal block for testing */
function block(type: ContentBlock['type']): ContentBlock {
  return { type } as ContentBlock;
}

describe('getBlockSize', () => {
  it('should return full for paragraph blocks', () => {
    expect(getBlockSize('paragraph')).toBe('full');
  });

  it('should return full for code blocks', () => {
    expect(getBlockSize('code')).toBe('full');
  });

  it('should return full for callout blocks (promoted from half)', () => {
    expect(getBlockSize('callout')).toBe('full');
  });

  it('should return full for quote blocks (promoted from half)', () => {
    expect(getBlockSize('quote')).toBe('full');
  });

  it('should return full for definition blocks (promoted from half)', () => {
    expect(getBlockSize('definition')).toBe('full');
  });

  it('should return full for verdict blocks (promoted from half)', () => {
    expect(getBlockSize('verdict')).toBe('full');
  });

  it('should return half for data-dense blocks', () => {
    expect(getBlockSize('pro_con')).toBe('half');
    expect(getBlockSize('cost')).toBe('half');
    expect(getBlockSize('nutrition')).toBe('half');
    expect(getBlockSize('guest')).toBe('half');
    expect(getBlockSize('formula')).toBe('half');
    expect(getBlockSize('rating')).toBe('half');
  });

  it('should return compact for statistic blocks', () => {
    expect(getBlockSize('statistic')).toBe('compact');
  });

  it('should return compact for keyvalue blocks', () => {
    expect(getBlockSize('keyvalue')).toBe('compact');
  });
});

describe('groupBlocksBySize', () => {
  it('should return empty array for empty input', () => {
    expect(groupBlocksBySize([])).toEqual([]);
  });

  it('should group consecutive same-size blocks', () => {
    const blocks = [block('statistic'), block('keyvalue'), block('statistic')];
    const groups = groupBlocksBySize(blocks);

    expect(groups).toHaveLength(1);
    expect(groups[0].size).toBe('compact');
    expect(groups[0].blocks).toHaveLength(3);
  });

  it('should split groups when size changes', () => {
    const blocks = [
      block('paragraph'),
      block('statistic'),
      block('keyvalue'),
      block('code'),
    ];
    const groups = groupBlocksBySize(blocks);

    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual({ size: 'full', blocks: [blocks[0]] });
    expect(groups[1]).toEqual({ size: 'compact', blocks: [blocks[1], blocks[2]] });
    expect(groups[2]).toEqual({ size: 'full', blocks: [blocks[3]] });
  });

  it('should handle all-same-size array', () => {
    const blocks = [block('paragraph'), block('bullets'), block('code')];
    const groups = groupBlocksBySize(blocks);

    expect(groups).toHaveLength(1);
    expect(groups[0].size).toBe('full');
    expect(groups[0].blocks).toHaveLength(3);
  });

  it('should handle single block', () => {
    const blocks = [block('pro_con')];
    const groups = groupBlocksBySize(blocks);

    expect(groups).toHaveLength(1);
    expect(groups[0].size).toBe('half');
    expect(groups[0].blocks).toHaveLength(1);
  });

  it('should handle mixed block types correctly', () => {
    const blocks = [
      block('paragraph'),     // full
      block('callout'),       // full (promoted)
      block('quote'),         // full (promoted)
      block('definition'),    // full (promoted)
      block('statistic'),     // compact
      block('keyvalue'),      // compact
      block('timestamp'),     // compact
      block('code'),          // full
    ];
    const groups = groupBlocksBySize(blocks);

    // callout, quote, definition are now full → they group with paragraph
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ size: 'full' });
    expect(groups[0].blocks).toHaveLength(4); // paragraph + callout + quote + definition
    expect(groups[1]).toMatchObject({ size: 'compact' });
    expect(groups[1].blocks).toHaveLength(3);
    expect(groups[2]).toMatchObject({ size: 'full' });
    expect(groups[2].blocks).toHaveLength(1);
  });

  it('should handle streaming scenario (progressively growing array)', () => {
    const allBlocks = [
      block('paragraph'),
      block('statistic'),
      block('keyvalue'),
      block('code'),
    ];

    // Simulate streaming: first 1 block, then 2, then 3, then 4
    for (let i = 1; i <= allBlocks.length; i++) {
      const partial = allBlocks.slice(0, i);
      const groups = groupBlocksBySize(partial);
      // Should always return valid groups without throwing
      expect(groups.length).toBeGreaterThan(0);
      // Total blocks in groups should equal input length
      const totalBlocks = groups.reduce((sum: number, g: BlockGroup) => sum + g.blocks.length, 0);
      expect(totalBlocks).toBe(i);
    }
  });

  it('should handle alternating sizes', () => {
    const blocks = [
      block('paragraph'),  // full
      block('pro_con'),    // half
      block('code'),       // full
      block('rating'),     // half
    ];
    const groups = groupBlocksBySize(blocks);

    expect(groups).toHaveLength(4);
    expect(groups.map(g => g.size)).toEqual(['full', 'half', 'full', 'half']);
  });
});

describe('getSpacingCategory', () => {
  it('should return prose for paragraph', () => {
    expect(getSpacingCategory('paragraph')).toBe('prose');
  });

  it('should return list for bullet/numbered types', () => {
    expect(getSpacingCategory('bullets')).toBe('list');
    expect(getSpacingCategory('numbered')).toBe('list');
    expect(getSpacingCategory('do_dont')).toBe('list');
    expect(getSpacingCategory('definition')).toBe('list');
    expect(getSpacingCategory('tool_list')).toBe('list');
  });

  it('should return list for step and ingredient', () => {
    expect(getSpacingCategory('step')).toBe('list');
    expect(getSpacingCategory('ingredient')).toBe('list');
  });

  it('should return visual for large block types', () => {
    expect(getSpacingCategory('code')).toBe('visual');
    expect(getSpacingCategory('terminal')).toBe('visual');
    expect(getSpacingCategory('table')).toBe('visual');
    expect(getSpacingCategory('example')).toBe('visual');
    expect(getSpacingCategory('quiz')).toBe('visual');
  });

  it('should return dense for compact informational blocks', () => {
    expect(getSpacingCategory('callout')).toBe('dense');
    expect(getSpacingCategory('quote')).toBe('dense');
    expect(getSpacingCategory('statistic')).toBe('dense');
    expect(getSpacingCategory('keyvalue')).toBe('dense');
    expect(getSpacingCategory('timestamp')).toBe('dense');
    expect(getSpacingCategory('rating')).toBe('dense');
    expect(getSpacingCategory('verdict')).toBe('dense');
  });

  it('should return dense for data blocks (reclassified from visual)', () => {
    expect(getSpacingCategory('pro_con')).toBe('dense');
    expect(getSpacingCategory('cost')).toBe('dense');
    expect(getSpacingCategory('nutrition')).toBe('dense');
    expect(getSpacingCategory('guest')).toBe('dense');
    expect(getSpacingCategory('formula')).toBe('dense');
  });
});

describe('getBlockSpacing', () => {
  it('should return empty string for first block (null prev)', () => {
    expect(getBlockSpacing(null, 'paragraph')).toBe('');
    expect(getBlockSpacing(null, 'code')).toBe('');
  });

  it('should return tight spacing for prose→prose', () => {
    expect(getBlockSpacing('paragraph', 'paragraph')).toBe('mt-1.5');
  });

  it('should return medium spacing for prose→visual', () => {
    expect(getBlockSpacing('paragraph', 'code')).toBe('mt-3');
  });

  it('should return medium spacing for visual→prose', () => {
    expect(getBlockSpacing('code', 'paragraph')).toBe('mt-3');
  });

  it('should return medium spacing for visual→visual', () => {
    expect(getBlockSpacing('code', 'terminal')).toBe('mt-2.5');
  });

  it('should return tight spacing for dense→dense', () => {
    expect(getBlockSpacing('callout', 'quote')).toBe('mt-1.5');
  });

  it('should return small spacing for list→prose', () => {
    expect(getBlockSpacing('bullets', 'paragraph')).toBe('mt-2');
  });

  it('should return medium spacing for list→visual', () => {
    expect(getBlockSpacing('bullets', 'code')).toBe('mt-3');
  });
});

/** Test-only grid classes (simpler than production values, same structure). */
const GRID_CLASSES: Record<BlockGroup['size'], string> = {
  full: '',
  half: 'grid grid-cols-2 gap-3',
  compact: 'grid grid-cols-3 gap-3',
};

describe('computeSpacingMap', () => {
  it('should return empty map for empty groups', () => {
    const map = computeSpacingMap([], GRID_CLASSES);
    expect(map.size).toBe(0);
  });

  it('should assign empty string to first block', () => {
    const blocks = [block('paragraph')];
    const groups = groupBlocksBySize(blocks);
    const map = computeSpacingMap(groups, GRID_CLASSES);

    expect(map.get(blocks[0])).toBe('');
  });

  it('should compute per-block spacing for full-width groups', () => {
    const blocks = [block('paragraph'), block('code'), block('paragraph')];
    const groups = groupBlocksBySize(blocks);
    const map = computeSpacingMap(groups, GRID_CLASSES);

    expect(map.get(blocks[0])).toBe('');          // first block
    expect(map.get(blocks[1])).toBe('mt-3');      // prose→visual
    expect(map.get(blocks[2])).toBe('mt-3');      // visual→prose
  });

  it('should compute container spacing for grid groups', () => {
    const blocks = [block('paragraph'), block('statistic'), block('keyvalue')];
    const groups = groupBlocksBySize(blocks);
    const map = computeSpacingMap(groups, GRID_CLASSES);

    // paragraph gets empty (first)
    expect(map.get(blocks[0])).toBe('');
    // statistic is first block of compact grid group → prose→dense spacing
    expect(map.get(blocks[1])).toBe('mt-2');
    // keyvalue is NOT in the map (grid group only stores first block's spacing)
    expect(map.has(blocks[2])).toBe(false);
  });

  it('should treat single orphan half/compact blocks as full-width', () => {
    const blocks = [block('paragraph'), block('pro_con')];
    const groups = groupBlocksBySize(blocks);
    const map = computeSpacingMap(groups, GRID_CLASSES);

    // pro_con is a single orphan half block → treated as full-width, gets per-block spacing
    expect(map.get(blocks[1])).toBe('mt-2'); // prose→dense (pro_con is dense category)
  });
});

describe('SIDEBAR_COMPATIBLE_TYPES', () => {
  it('should include data-dense block types', () => {
    expect(SIDEBAR_COMPATIBLE_TYPES.has('rating')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('nutrition')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('cost')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('keyvalue')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('statistic')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('ingredient')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('tool_list')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('guest')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('timestamp')).toBe(true);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('formula')).toBe(true);
  });

  it('should not include full-width block types', () => {
    expect(SIDEBAR_COMPATIBLE_TYPES.has('paragraph')).toBe(false);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('code')).toBe(false);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('comparison')).toBe(false);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('table')).toBe(false);
    expect(SIDEBAR_COMPATIBLE_TYPES.has('step')).toBe(false);
  });
});

