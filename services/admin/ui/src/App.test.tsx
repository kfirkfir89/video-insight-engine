import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should export App as default', async () => {
    const mod = await import('./App');
    expect(typeof mod.default).toBe('function');
  });
});
