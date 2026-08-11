import { describe, it, expect } from 'vitest';

describe('DashboardPage', () => {
  it('should export DashboardPage component', async () => {
    const mod = await import('./DashboardPage');
    expect(typeof mod.DashboardPage).toBe('function');
  });
});
