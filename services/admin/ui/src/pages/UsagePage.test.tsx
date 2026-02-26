import { describe, it, expect } from 'vitest';

describe('UsagePage', () => {
  it('should export UsagePage component', async () => {
    const mod = await import('./UsagePage');
    expect(typeof mod.UsagePage).toBe('function');
  });
});
