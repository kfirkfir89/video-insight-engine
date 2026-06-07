import { describe, it, expect } from 'vitest';

import { computeGraphLayout, type GraphLayoutNode, type GraphLayoutEdge } from '../useGraphLayout';

const nodes: GraphLayoutNode[] = [
  { id: 'a', group: 'Foundations' },
  { id: 'b', group: 'Foundations' },
  { id: 'c', group: 'Applications' },
];
const edges: GraphLayoutEdge[] = [{ source: 'a', target: 'b' }];
const groups = ['Foundations', 'Applications'];

describe('computeGraphLayout', () => {
  it('produces deterministic positions for identical input', () => {
    const first = computeGraphLayout(nodes, edges, groups);
    const second = computeGraphLayout(nodes, edges, groups);
    expect(second.positions).toEqual(first.positions);
  });

  it('separates groups into distinct horizontal lanes', () => {
    const { positions } = computeGraphLayout(nodes, edges, groups);
    const foundationsMaxX = Math.max(positions.a.x, positions.b.x);
    const applicationsMinX = positions.c.x;
    // The Applications lane sits entirely to the right of the Foundations lane.
    expect(applicationsMinX).toBeGreaterThan(foundationsMaxX);
  });

  it('tiers a connected pair top-to-bottom by rank', () => {
    const { positions } = computeGraphLayout(nodes, edges, groups);
    // a → b means a ranks above b.
    expect(positions.a.y).toBeLessThan(positions.b.y);
  });

  it('returns one position per node and a non-zero extent', () => {
    const layout = computeGraphLayout(nodes, edges, groups);
    expect(Object.keys(layout.positions)).toHaveLength(3);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.groupBounds).toHaveLength(2);
  });
});
