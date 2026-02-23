import { describe, it, expect } from 'vitest';
import { computeAutoFlowLayout } from '../auto-flow-layout';
import type { ContentBlock } from '@vie/types';

function block(type: ContentBlock['type']): ContentBlock {
  return { type } as ContentBlock;
}

describe('computeAutoFlowLayout', () => {
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
    // Sidebar block should be in first column
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
    // verdict is not sidebar-compatible, rating is → sidebar-main
    expect(rows[0].type).toBe('sidebar-main');
    expect(rows[0].columns[0][0].type).toBe('rating');
    expect(rows[0].columns[1][0].type).toBe('verdict');
  });

  it('should handle complementary pair: cost + nutrition', () => {
    const rows = computeAutoFlowLayout([block('cost'), block('nutrition')]);

    expect(rows).toHaveLength(1);
    // Both sidebar-compatible → equal-2
    expect(rows[0].type).toBe('equal-2');
  });

  it('should handle complementary pair: guest + quote', () => {
    const rows = computeAutoFlowLayout([block('guest'), block('quote')]);

    expect(rows).toHaveLength(1);
    // guest is sidebar-compatible, quote is not → sidebar-main
    expect(rows[0].type).toBe('sidebar-main');
  });

  it('should handle odd number of sidebar-compatible blocks', () => {
    const rows = computeAutoFlowLayout([
      block('rating'),
      block('cost'),
      block('nutrition'),
    ]);

    expect(rows).toHaveLength(2);
    // First two pair as equal-2
    expect(rows[0].type).toBe('equal-2');
    // Third one is alone → full
    expect(rows[1].type).toBe('full');
  });

  it('should pair odd sidebar block with following full-width block', () => {
    const rows = computeAutoFlowLayout([
      block('rating'),
      block('cost'),
      block('nutrition'),
      block('paragraph'),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('equal-2');
    // nutrition + paragraph → sidebar-main
    expect(rows[1].type).toBe('sidebar-main');
  });

  it('should handle all full-width blocks', () => {
    const rows = computeAutoFlowLayout([
      block('paragraph'),
      block('code'),
      block('table'),
    ]);

    // paragraph+code won't pair (both full-width)
    // Each becomes its own full row except complementary pairs
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

    // paragraph + rating → sidebar-main
    expect(rows[0].type).toBe('sidebar-main');
    // code + cost → sidebar-main
    expect(rows[1].type).toBe('sidebar-main');
    // nutrition + table → sidebar-main
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
