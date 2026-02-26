import { describe, it, expect } from 'vitest';

describe('RecentCalls', () => {
  it('should export RecentCalls component', async () => {
    const mod = await import('./RecentCalls');
    expect(typeof mod.RecentCalls).toBe('function');
  });
});
