import { describe, it, expect } from 'vitest';

describe('AlertsBanner', () => {
  it('should export AlertsBanner component', async () => {
    const mod = await import('./AlertsBanner');
    expect(typeof mod.AlertsBanner).toBe('function');
  });
});
