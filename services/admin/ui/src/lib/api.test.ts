import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tests for API client module
describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setApiKey / hasApiKey / clearApiKey', () => {
    it('should store and detect API key', async () => {
      const { setApiKey, hasApiKey } = await import('./api');
      expect(hasApiKey()).toBe(false);
      setApiKey('test-key');
      expect(hasApiKey()).toBe(true);
    });

    it('should clear API key', async () => {
      const { setApiKey, hasApiKey, clearApiKey } = await import('./api');
      setApiKey('test-key');
      clearApiKey();
      expect(hasApiKey()).toBe(false);
    });
  });

  describe('api.usage.stats', () => {
    it('should call /usage/stats with days param', async () => {
      const { api, setApiKey } = await import('./api');
      setApiKey('my-key');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ total_calls: 10, total_cost_usd: 1.5 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await api.usage.stats(7);
      expect(mockFetch).toHaveBeenCalledWith('/usage/stats?days=7', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-key' }),
      }));
      expect(result).toEqual({ total_calls: 10, total_cost_usd: 1.5 });
    });

    it('should throw on 401 and clear key', async () => {
      const { api, setApiKey, hasApiKey } = await import('./api');
      setApiKey('bad-key');
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', { value: { reload: reloadMock }, writable: true });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' }));

      await expect(api.usage.stats()).rejects.toThrow('Unauthorized');
      expect(hasApiKey()).toBe(false);
    });
  });

  describe('api.health.services', () => {
    it('should call /health/services', async () => {
      const { api, setApiKey } = await import('./api');
      setApiKey('key');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ 'vie-api': { status: 'healthy' } }),
      }));

      const result = await api.health.services();
      expect(result).toHaveProperty('vie-api');
    });
  });
});
