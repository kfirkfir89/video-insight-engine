import { describe, it, expect } from 'vitest';

describe('FeatureBreakdown', () => {
  it('should export FeatureBreakdown component', async () => {
    const mod = await import('./FeatureBreakdown');
    expect(typeof mod.FeatureBreakdown).toBe('function');
  });
});
