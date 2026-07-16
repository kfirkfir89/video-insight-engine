import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import amqplib from 'amqplib';
import { rabbitmqPlugin } from './rabbitmq.js';

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(),
  },
}));

type Handler = (...args: unknown[]) => void;

interface FakeConnection {
  handlers: Record<string, Handler>;
  on: ReturnType<typeof vi.fn>;
  createConfirmChannel: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createFakeChannel() {
  return {
    on: vi.fn(),
    assertExchange: vi.fn(async () => undefined),
    assertQueue: vi.fn(async () => undefined),
    bindQueue: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

function createFakeConnection(): FakeConnection {
  const handlers: Record<string, Handler> = {};
  const conn: FakeConnection = {
    handlers,
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
    }),
    createConfirmChannel: vi.fn(async () => createFakeChannel()),
    close: vi.fn(async () => undefined),
  };
  return conn;
}

describe('rabbitmq plugin', () => {
  let app: FastifyInstance;
  const mockedConnect = vi.mocked(amqplib.connect);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
  });

  async function buildApp(): Promise<FastifyInstance> {
    app = Fastify({ logger: false });
    await app.register(rabbitmqPlugin);
    await app.ready();
    return app;
  }

  it('connects once at startup and reuses the channel while healthy', async () => {
    const conn = createFakeConnection();
    mockedConnect.mockResolvedValue(conn as never);

    await buildApp();
    expect(mockedConnect).toHaveBeenCalledTimes(1);

    const ch1 = await app.rabbitmq.getChannel();
    const ch2 = await app.rabbitmq.getChannel();
    expect(ch1).toBe(ch2);
    expect(mockedConnect).toHaveBeenCalledTimes(1);
    expect(app.rabbitmq.isReady()).toBe(true);
  });

  it('opens exactly ONE new connection when concurrent getChannel calls race after a drop', async () => {
    const conn = createFakeConnection();
    // Delay every connect so racing callers overlap the in-flight attempt.
    mockedConnect.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(createFakeConnection() as never), 20);
        }),
    );
    // First (startup) connect resolves immediately with our tracked conn.
    mockedConnect.mockResolvedValueOnce(conn as never);

    await buildApp();
    expect(mockedConnect).toHaveBeenCalledTimes(1);

    // Simulate the broker dropping the connection — plugin clears its state.
    conn.handlers['close']?.();
    expect(app.rabbitmq.isReady()).toBe(false);

    // Two concurrent callers during the blip must share one reconnect.
    const [ch1, ch2] = await Promise.all([
      app.rabbitmq.getChannel(),
      app.rabbitmq.getChannel(),
    ]);
    expect(ch1).toBe(ch2);
    expect(mockedConnect).toHaveBeenCalledTimes(2); // startup + ONE reconnect
  });

  it('clears the in-flight attempt on failure so the next call retries', async () => {
    const conn = createFakeConnection();
    mockedConnect.mockResolvedValueOnce(conn as never);
    await buildApp();

    conn.handlers['close']?.();

    mockedConnect.mockRejectedValueOnce(new Error('broker down'));
    await expect(app.rabbitmq.getChannel()).rejects.toThrow('broker down');

    // A later call must attempt a FRESH connect, not reuse the rejected promise.
    const conn2 = createFakeConnection();
    mockedConnect.mockResolvedValueOnce(conn2 as never);
    await expect(app.rabbitmq.getChannel()).resolves.toBeDefined();
    expect(mockedConnect).toHaveBeenCalledTimes(3);
  });
});
