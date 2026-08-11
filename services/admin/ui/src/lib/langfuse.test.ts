import { describe, it, expect, vi, afterEach } from 'vitest';

// We test the URL builder logic — mock import.meta.env per-test using vi.stubEnv.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildLangfuseTraceUrl', () => {
  it('should return null when VITE_LANGFUSE_BASE_URL is unset', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', '');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-abc');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    expect(buildLangfuseTraceUrl({ requestId: 'req-1' })).toBeNull();
  });

  it('should return null when VITE_LANGFUSE_PROJECT_ID is unset', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', '');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    expect(buildLangfuseTraceUrl({ requestId: 'req-1' })).toBeNull();
  });

  it('should return null when both env vars are unset', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', '');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', '');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    expect(buildLangfuseTraceUrl({ requestId: 'req-1' })).toBeNull();
  });

  it('should return a URL string when both env vars are configured', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-abc');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    const url = buildLangfuseTraceUrl({ requestId: 'req-xyz' });
    expect(url).not.toBeNull();
    expect(typeof url).toBe('string');
  });

  it('should include the project id in the returned URL', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-abc');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    const url = buildLangfuseTraceUrl({ requestId: 'req-xyz' });
    expect(url).toContain('proj-abc');
  });

  it('should encode the requestId tag in the URL', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-abc');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    const url = buildLangfuseTraceUrl({ requestId: 'req-xyz' });
    expect(url).toContain('req-xyz');
  });

  it('should use videoSummaryId when requestId is null', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-abc');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    const url = buildLangfuseTraceUrl({ requestId: null, videoSummaryId: 'vsid-123' });
    expect(url).toContain('vsid-123');
  });

  it('should return null when both requestId and videoSummaryId are null', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-abc');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    expect(buildLangfuseTraceUrl({ requestId: null, videoSummaryId: null })).toBeNull();
  });

  it('should start with the configured base URL', async () => {
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://custom.langfuse.example.com');
    vi.stubEnv('VITE_LANGFUSE_PROJECT_ID', 'proj-xyz');
    vi.resetModules();
    const { buildLangfuseTraceUrl } = await import('./langfuse');
    const url = buildLangfuseTraceUrl({ requestId: 'r1' });
    expect(url?.startsWith('https://custom.langfuse.example.com')).toBe(true);
  });
});
