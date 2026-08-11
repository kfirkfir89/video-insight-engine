import { describe, it, expect } from 'vitest';

import { edgeStyleForRelation, isDirectionalRelation } from '../FloatingEdge';

describe('edgeStyleForRelation', () => {
  it('renders causes/requires as a solid line (no dash)', () => {
    expect(edgeStyleForRelation('causes', 'rest').strokeDasharray).toBeUndefined();
    expect(edgeStyleForRelation('requires', 'rest').strokeDasharray).toBeUndefined();
  });

  it('renders contrasts as a dashed line', () => {
    expect(edgeStyleForRelation('contrasts', 'rest').strokeDasharray).toBe('7 5');
  });

  it('renders partOf/relatesTo as a dotted line', () => {
    expect(edgeStyleForRelation('relatesTo', 'rest').strokeDasharray).toBe('1.5 6');
    expect(edgeStyleForRelation('partOf', 'rest').strokeDasharray).toBe('1.5 6');
  });

  it('uses a single accent stroke for every relation (no hue encoding)', () => {
    const strokes = (['causes', 'contrasts', 'partOf', 'relatesTo', 'requires'] as const).map(
      (r) => edgeStyleForRelation(r, 'rest').stroke,
    );
    expect(new Set(strokes).size).toBe(1);
  });

  it('brightens on active and dims on dimmed', () => {
    const rest = edgeStyleForRelation('causes', 'rest');
    const active = edgeStyleForRelation('causes', 'active');
    const dimmed = edgeStyleForRelation('causes', 'dimmed');
    expect(Number(active.opacity)).toBeGreaterThan(Number(rest.opacity));
    expect(Number(rest.opacity)).toBeGreaterThan(Number(dimmed.opacity));
    expect(Number(active.strokeWidth)).toBeGreaterThan(Number(dimmed.strokeWidth));
  });
});

describe('isDirectionalRelation', () => {
  it('marks causes and requires as directional', () => {
    expect(isDirectionalRelation('causes')).toBe(true);
    expect(isDirectionalRelation('requires')).toBe(true);
  });

  it('marks associative relations as non-directional', () => {
    expect(isDirectionalRelation('contrasts')).toBe(false);
    expect(isDirectionalRelation('partOf')).toBe(false);
    expect(isDirectionalRelation('relatesTo')).toBe(false);
  });
});
