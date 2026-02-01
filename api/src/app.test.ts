import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';

describe('buildApp', () => {
  describe('with container override', () => {
    it('should allow partial container override for testing', async () => {
      const mockExplainerClient = {
        explainAuto: vi.fn().mockResolvedValue({ expansion: 'test' }),
        explainChat: vi.fn().mockResolvedValue({ chatId: '123', response: 'test' }),
        explainChatStream: vi.fn().mockResolvedValue({ body: null }),
      };

      const app = await buildApp({
        logger: false,
        container: {
          explainerClient: mockExplainerClient as unknown as typeof app.container.explainerClient,
        },
      });

      await app.ready();

      // Verify the mock was injected
      expect(app.container.explainerClient.explainAuto).toBe(mockExplainerClient.explainAuto);

      await app.close();
    });

    it('should use real container when no override provided', async () => {
      const app = await buildApp({
        logger: false,
      });

      await app.ready();

      // Verify container exists and has expected services
      expect(app.container).toBeDefined();
      expect(app.container.explainerClient).toBeDefined();
      expect(app.container.videoService).toBeDefined();

      await app.close();
    });
  });

  describe('health check', () => {
    it('should respond to /health endpoint', async () => {
      const app = await buildApp({ logger: false });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('status', 'ok');

      await app.close();
    });
  });
});
