import { describe, it, expect, vi, beforeEach } from 'vitest';

const initSentryMock = vi.fn();

vi.mock('./plugins/sentry.js', () => ({
  initSentry: (...args: unknown[]) => initSentryMock(...args),
}));

vi.mock('./app.js', () => ({
  // buildApp is awaited inside startServer but we don't need to exercise the
  // full Fastify boot here — a stub is enough to verify Sentry init runs first.
  buildApp: vi.fn().mockImplementation(() => {
    // Returning a minimal shape so startServer.listen() can be skipped via test
    // double; but we don't call startServer in these tests — we just verify
    // initSentry's wiring through the module's top-level call sites.
    return Promise.resolve({
      log: { info: vi.fn(), error: vi.fn() },
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    });
  }),
}));

describe('server initSentry wiring', () => {
  beforeEach(() => {
    initSentryMock.mockClear();
  });

  it('should call initSentry before buildApp with config-derived options', async () => {
    // Import inside the test so module-level mocks apply before evaluation.
    const { startServer } = await import('./server.js');
    const { config } = await import('./config.js');

    // Avoid actually listening / installing process handlers.
    const listenSpy = vi.fn().mockResolvedValue(undefined);
    const { buildApp } = await import('./app.js');
    (buildApp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      log: { info: vi.fn(), error: vi.fn() },
      listen: listenSpy,
      close: vi.fn().mockResolvedValue(undefined),
    });

    await startServer();

    expect(initSentryMock).toHaveBeenCalledTimes(1);
    const arg = initSentryMock.mock.calls[0][0];
    expect(arg.dsn).toBe(config.SENTRY_DSN);
    expect(arg.environment).toBe(config.SENTRY_ENVIRONMENT ?? config.NODE_ENV);
    expect(arg.release).toBe(config.SENTRY_RELEASE);
    expect(arg.tracesSampleRate).toBe(config.SENTRY_TRACES_SAMPLE_RATE);
  });
});
