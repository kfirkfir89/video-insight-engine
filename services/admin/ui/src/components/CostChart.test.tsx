import { describe, it, expect } from 'vitest';

describe('CostChart', () => {
  it('should export CostChart component', async () => {
    const mod = await import('./CostChart');
    expect(typeof mod.CostChart).toBe('function');
  });
});
