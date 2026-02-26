import { describe, it, expect } from 'vitest';

describe('AlertsPage', () => {
  it('should export AlertsPage component', async () => {
    const mod = await import('./AlertsPage');
    expect(typeof mod.AlertsPage).toBe('function');
  });
});
