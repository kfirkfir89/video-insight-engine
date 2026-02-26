import { describe, it, expect } from 'vitest';

// Hooks are thin wrappers around useQuery — test that they export correctly
describe('use-admin-api hooks', () => {
  it('should export all hook functions', async () => {
    const hooks = await import('./use-admin-api');
    expect(typeof hooks.useUsageStats).toBe('function');
    expect(typeof hooks.useUsageDaily).toBe('function');
    expect(typeof hooks.useUsageByFeature).toBe('function');
    expect(typeof hooks.useUsageByModel).toBe('function');
    expect(typeof hooks.useUsageByService).toBe('function');
    expect(typeof hooks.useUsageByVideo).toBe('function');
    expect(typeof hooks.useUsageRecent).toBe('function');
    expect(typeof hooks.useUsageDuplicates).toBe('function');
    expect(typeof hooks.useHealthServices).toBe('function');
    expect(typeof hooks.useHealthOverview).toBe('function');
    expect(typeof hooks.useHealthUptime).toBe('function');
    expect(typeof hooks.useAlertsRecent).toBe('function');
    expect(typeof hooks.useAlertConfig).toBe('function');
  });
});
