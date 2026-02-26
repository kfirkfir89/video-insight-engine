import { describe, it, expect } from 'vitest';

describe('StatsCards', () => {
  it('should export StatsCards component', async () => {
    const mod = await import('./StatsCards');
    expect(typeof mod.StatsCards).toBe('function');
  });
});
