import { describe, it, expect } from 'vitest';

describe('LoginPrompt', () => {
  it('should export LoginPrompt component', async () => {
    const mod = await import('./LoginPrompt');
    expect(typeof mod.LoginPrompt).toBe('function');
  });
});
