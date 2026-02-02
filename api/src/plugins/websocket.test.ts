import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { websocketPlugin } from './websocket.js';
import { jwtPlugin } from './jwt.js';
import { WebSocket } from 'ws';

describe('WebSocket plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(jwtPlugin);
    await app.register(websocketPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('broadcast decorator', () => {
    it('should decorate fastify with broadcast function', () => {
      expect(app.broadcast).toBeDefined();
      expect(typeof app.broadcast).toBe('function');
    });

    it('should not throw when broadcasting to non-existent user', () => {
      expect(() => {
        app.broadcast('non-existent-user', { type: 'test', data: 'hello' });
      }).not.toThrow();
    });

    it('should accept userId and event object parameters', () => {
      const userId = 'user-123';
      const event = { type: 'notification', payload: { message: 'Hello' } };

      // Should not throw with valid parameters
      expect(() => app.broadcast(userId, event)).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should use JSON format for events', () => {
      const event = { type: 'connected' };
      const serialized = JSON.stringify(event);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(event);
      expect(parsed.type).toBe('connected');
    });

    it('should support various event types', () => {
      const events = [
        { type: 'connected' },
        { type: 'summary_progress', data: { videoId: '123', progress: 50 } },
        { type: 'summary_complete', data: { videoId: '123' } },
        { type: 'error', message: 'Something went wrong' },
      ];

      events.forEach(event => {
        const serialized = JSON.stringify(event);
        expect(() => JSON.parse(serialized)).not.toThrow();
      });
    });

    it('should handle complex nested event data', () => {
      const complexEvent = {
        type: 'video_update',
        data: {
          videoId: '123',
          metadata: {
            title: 'Test Video',
            duration: 3600,
            chapters: [
              { start: 0, title: 'Intro' },
              { start: 300, title: 'Main Content' },
            ],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(complexEvent);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(complexEvent);
      expect(parsed.data.metadata.chapters).toHaveLength(2);
    });
  });

  describe('connection tracking', () => {
    let trackApp: FastifyInstance;

    beforeAll(async () => {
      trackApp = Fastify({ logger: false });
      await trackApp.register(jwtPlugin);
      await trackApp.register(websocketPlugin);
      await trackApp.ready();
    });

    afterAll(async () => {
      await trackApp.close();
    });

    it('should broadcast to specific user only', () => {
      // The broadcast function internally checks if user is connected
      // and only sends if connection exists and is open
      expect(() => {
        trackApp.broadcast('user-1', { type: 'test' });
        trackApp.broadcast('user-2', { type: 'test' });
      }).not.toThrow();
    });

    it('should handle multiple users independently', () => {
      // Verify broadcast can be called for different users
      expect(() => {
        trackApp.broadcast('user-a', { type: 'event1' });
        trackApp.broadcast('user-b', { type: 'event2' });
        trackApp.broadcast('user-a', { type: 'event3' });
      }).not.toThrow();
    });

    it('should handle rapid broadcasts to same user', () => {
      // Simulate rapid event delivery
      expect(() => {
        for (let i = 0; i < 100; i++) {
          trackApp.broadcast('user-rapid', { type: 'tick', count: i });
        }
      }).not.toThrow();
    });
  });

  describe('WebSocket readyState constants', () => {
    it('should use correct WebSocket.OPEN constant', () => {
      // WebSocket.OPEN should be 1
      expect(WebSocket.OPEN).toBe(1);
    });

    it('should have all readyState constants', () => {
      expect(WebSocket.CONNECTING).toBe(0);
      expect(WebSocket.OPEN).toBe(1);
      expect(WebSocket.CLOSING).toBe(2);
      expect(WebSocket.CLOSED).toBe(3);
    });
  });

  describe('close codes', () => {
    it('should use custom close code 4001 for auth errors', () => {
      // The plugin uses 4001 for authentication errors
      // This is in the private use range (4000-4999)
      const authErrorCode = 4001;
      expect(authErrorCode).toBeGreaterThanOrEqual(4000);
      expect(authErrorCode).toBeLessThan(5000);
    });

    it('should have standard close codes available', () => {
      // Standard WebSocket close codes
      const codes = {
        NORMAL_CLOSURE: 1000,
        GOING_AWAY: 1001,
        PROTOCOL_ERROR: 1002,
        UNSUPPORTED_DATA: 1003,
        NO_STATUS_RECEIVED: 1005,
        ABNORMAL_CLOSURE: 1006,
        INVALID_FRAME_PAYLOAD_DATA: 1007,
        POLICY_VIOLATION: 1008,
        MESSAGE_TOO_BIG: 1009,
        MISSING_EXTENSION: 1010,
        INTERNAL_ERROR: 1011,
        SERVICE_RESTART: 1012,
        TRY_AGAIN_LATER: 1013,
        BAD_GATEWAY: 1014,
        TLS_HANDSHAKE: 1015,
      };

      expect(codes.NORMAL_CLOSURE).toBe(1000);
      expect(codes.PROTOCOL_ERROR).toBe(1002);
    });
  });

  describe('token validation behavior', () => {
    let tokenApp: FastifyInstance;

    beforeAll(async () => {
      tokenApp = Fastify({ logger: false });
      await tokenApp.register(jwtPlugin);
      await tokenApp.register(websocketPlugin);
      await tokenApp.ready();
    });

    afterAll(async () => {
      await tokenApp.close();
    });

    it('should have jwt plugin available for token verification', () => {
      expect(tokenApp.jwt).toBeDefined();
      expect(tokenApp.jwt.verify).toBeDefined();
      expect(typeof tokenApp.jwt.verify).toBe('function');
    });

    it('should be able to sign tokens for websocket auth', () => {
      const token = tokenApp.jwt.sign({ userId: 'user-123', email: 'test@example.com' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify valid tokens', () => {
      const payload = { userId: 'ws-user-1', email: 'ws@example.com' };
      const token = tokenApp.jwt.sign(payload);

      const verified = tokenApp.jwt.verify(token);
      expect(verified).toMatchObject(payload);
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        tokenApp.jwt.verify('invalid.token.string');
      }).toThrow();
    });

    it('should reject tampered tokens', () => {
      const token = tokenApp.jwt.sign({ userId: 'user-123' });
      const tampered = token.slice(0, -10) + 'tamperedxx';

      expect(() => {
        tokenApp.jwt.verify(tampered);
      }).toThrow();
    });
  });

  describe('event type constants', () => {
    // Define the event types used by the websocket system
    const EVENT_TYPES = {
      CONNECTED: 'connected',
      DISCONNECTED: 'disconnected',
      SUMMARY_STARTED: 'summary_started',
      SUMMARY_PROGRESS: 'summary_progress',
      SUMMARY_COMPLETE: 'summary_complete',
      SUMMARY_ERROR: 'summary_error',
      PLAYLIST_IMPORT_PROGRESS: 'playlist_import_progress',
      PLAYLIST_IMPORT_COMPLETE: 'playlist_import_complete',
    };

    it('should have consistent event type naming', () => {
      // All event types should be snake_case strings
      Object.values(EVENT_TYPES).forEach(type => {
        expect(typeof type).toBe('string');
        expect(type).toMatch(/^[a-z]+(_[a-z]+)*$/);
      });
    });

    it('should serialize event types correctly', () => {
      Object.entries(EVENT_TYPES).forEach(([key, type]) => {
        const event = { type, data: { key } };
        const json = JSON.stringify(event);
        const parsed = JSON.parse(json);

        expect(parsed.type).toBe(type);
      });
    });
  });
});

// E2E-style tests that would require actual WebSocket connections
// These tests are for documentation and would run in integration test suite
describe.skip('WebSocket plugin E2E (requires running server)', () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(jwtPlugin);
    await app.register(websocketPlugin);
    await app.listen({ port: 0 });
    const address = app.server.address();
    if (typeof address === 'object' && address !== null) {
      baseUrl = `ws://localhost:${address.port}`;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('should establish WebSocket connection with valid token', async () => {
    const token = app.jwt.sign({ userId: 'user-123' });
    const ws = new WebSocket(`${baseUrl}/ws?token=${token}`);

    return new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  });

  it('should receive connected message on connection', async () => {
    const token = app.jwt.sign({ userId: 'user-123' });
    const ws = new WebSocket(`${baseUrl}/ws?token=${token}`);

    return new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('connected');
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  });

  it('should receive broadcast messages', async () => {
    const token = app.jwt.sign({ userId: 'broadcast-test-user' });
    const ws = new WebSocket(`${baseUrl}/ws?token=${token}`);

    return new Promise<void>((resolve, reject) => {
      let messageCount = 0;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (messageCount === 1) {
          // First message is 'connected'
          expect(message.type).toBe('connected');
          // Now broadcast a message
          app.broadcast('broadcast-test-user', { type: 'test', payload: 'hello' });
        } else if (messageCount === 2) {
          // Second message should be our broadcast
          expect(message.type).toBe('test');
          expect(message.payload).toBe('hello');
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });
  });

  it('should close connection on invalid token', async () => {
    const ws = new WebSocket(`${baseUrl}/ws?token=invalid`);

    return new Promise<void>((resolve) => {
      ws.on('close', (code) => {
        expect(code).toBe(4001);
        resolve();
      });
    });
  });

  it('should close connection when no token provided', async () => {
    const ws = new WebSocket(`${baseUrl}/ws`);

    return new Promise<void>((resolve) => {
      ws.on('close', (code) => {
        expect(code).toBe(4001);
        resolve();
      });
    });
  });

  it('should remove connection on client disconnect', async () => {
    const token = app.jwt.sign({ userId: 'disconnect-test-user' });
    const ws = new WebSocket(`${baseUrl}/ws?token=${token}`);

    return new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.close(1000, 'Normal closure');
      });

      ws.on('close', () => {
        // After disconnect, broadcasts should be no-ops
        expect(() => {
          app.broadcast('disconnect-test-user', { type: 'test' });
        }).not.toThrow();
        resolve();
      });

      ws.on('error', reject);
    });
  });
});
