import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { Writable } from 'stream';
import { REQUEST_ID_HEADER, genRequestId, requestIdPlugin } from './request-id.js';

interface CapturedLog {
  level: number;
  msg?: string;
  requestId?: string;
  reqId?: string;
  [key: string]: unknown;
}

function buildLogCapture(): { logs: CapturedLog[]; stream: Writable } {
  const logs: CapturedLog[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const line = chunk.toString().trim();
      if (line) {
        try {
          logs.push(JSON.parse(line) as CapturedLog);
        } catch {
          // Pretty-printed lines aren't JSON; ignore — tests using log capture
          // configure JSON pino explicitly.
        }
      }
      callback();
    },
  });
  return { logs, stream };
}

async function buildTestApp(opts: { logStream?: Writable } = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    requestIdHeader: false,
    requestIdLogLabel: 'requestId',
    genReqId: genRequestId,
    logger: opts.logStream
      ? { level: 'info', stream: opts.logStream }
      : false,
  });
  await fastify.register(requestIdPlugin);

  fastify.get('/echo', async (request) => ({
    id: request.id,
  }));

  fastify.get('/boom', async () => {
    throw new Error('intentional');
  });

  fastify.log.info('warmup');
  return fastify;
}

describe('genRequestId', () => {
  function fakeReq(headerValue: unknown): { headers: Record<string, unknown> } {
    return { headers: { [REQUEST_ID_HEADER]: headerValue } };
  }

  it('should generate a UUID v4 when the header is absent', () => {
    const id = genRequestId({ headers: {} } as never);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should preserve a valid incoming header value', () => {
    const incoming = 'abc12345-trace-id-from-edge';
    const id = genRequestId(fakeReq(incoming) as never);
    expect(id).toBe(incoming);
  });

  it('should reject log-injection attempts and regenerate', () => {
    const badValue = 'abc\n[INFO] forged log line';
    const id = genRequestId(fakeReq(badValue) as never);
    expect(id).not.toBe(badValue);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should reject values longer than 128 chars', () => {
    const tooLong = 'a'.repeat(129);
    const id = genRequestId(fakeReq(tooLong) as never);
    expect(id).not.toBe(tooLong);
  });

  it('should reject values shorter than 8 chars', () => {
    const tooShort = 'short';
    const id = genRequestId(fakeReq(tooShort) as never);
    expect(id).not.toBe(tooShort);
  });

  it('should reject non-string header values', () => {
    const id = genRequestId(fakeReq(['array-header']) as never);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('requestIdPlugin', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('should set x-request-id on successful responses', async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/echo' });

    expect(res.statusCode).toBe(200);
    const id = res.headers[REQUEST_ID_HEADER];
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.json().id).toBe(id);
  });

  it('should echo a valid incoming x-request-id', async () => {
    app = await buildTestApp();
    const incoming = 'frontend-trace-abc12345';
    const res = await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { [REQUEST_ID_HEADER]: incoming },
    });

    expect(res.headers[REQUEST_ID_HEADER]).toBe(incoming);
    expect(res.json().id).toBe(incoming);
  });

  it('should set the response header even on errors', async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should bind requestId on the pino child logger', async () => {
    const { logs, stream } = buildLogCapture();
    app = await buildTestApp({ logStream: stream });

    const incoming = 'log-binding-test-abcdef';
    await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { [REQUEST_ID_HEADER]: incoming },
    });

    // Fastify logs request lifecycle ("incoming request", "request completed").
    // Each line goes through the per-request child logger and must include the id.
    const requestScopedLogs = logs.filter((l) => l.requestId === incoming);
    expect(requestScopedLogs.length).toBeGreaterThan(0);
  });
});
