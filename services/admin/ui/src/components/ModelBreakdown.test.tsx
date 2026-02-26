import { describe, it, expect } from 'vitest';

describe('ModelBreakdown', () => {
  it('should export ModelBreakdown component', async () => {
    const mod = await import('./ModelBreakdown');
    expect(typeof mod.ModelBreakdown).toBe('function');
  });
});
