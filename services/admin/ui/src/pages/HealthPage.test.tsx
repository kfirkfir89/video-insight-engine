import { describe, it, expect } from 'vitest';

describe('HealthPage', () => {
  it('should export HealthPage component', async () => {
    const mod = await import('./HealthPage');
    expect(typeof mod.HealthPage).toBe('function');
  });
});
