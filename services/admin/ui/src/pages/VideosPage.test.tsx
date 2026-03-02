import { describe, it, expect } from 'vitest';

describe('VideosPage', () => {
  it('should export VideosPage component', async () => {
    const mod = await import('./VideosPage');
    expect(typeof mod.VideosPage).toBe('function');
  });
});
