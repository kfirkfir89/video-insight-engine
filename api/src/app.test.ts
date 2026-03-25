import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';

describe('buildApp', () => {
  describe('with container override', () => {
    it('should allow partial container override for testing', async () => {
      const mockAssistantClient = {
        chat: vi.fn().mockResolvedValue(new ReadableStream()),
      };

      const app = await buildApp({
        logger: false,
        container: {
          assistantClient: mockAssistantClient as unknown as typeof app.container.assistantClient,
        },
      });

      await app.ready();

      // Verify the mock was injected
      expect(app.container.assistantClient.chat).toBe(mockAssistantClient.chat);

      await app.close();
    });

    it('should use real container when no override provided', async () => {
      const app = await buildApp({
        logger: false,
      });

      await app.ready();

      // Verify container exists and has expected services
      expect(app.container).toBeDefined();
      expect(app.container.assistantClient).toBeDefined();
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
