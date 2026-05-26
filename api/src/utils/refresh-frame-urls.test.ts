import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    S3_BUCKET: 'test-bucket',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_ENDPOINT_URL: '',
    FRAME_URL_TTL_SECONDS: 21600,
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: { input: { Key: string } }) => {
    return `https://signed.example.com/${command.input.Key}?sig=fresh`;
  }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  GetObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type RefreshFn = (tabs: unknown) => Promise<unknown>;

async function freshModule(): Promise<RefreshFn> {
  // Reset the module registry so the lazy signer cache inside refresh-frame-urls
  // re-initializes against whatever config mock is currently active. Pairs with
  // the per-test vi.mock / vi.doMock setup below.
  vi.resetModules();
  const mod = await import('./refresh-frame-urls.js');
  return mod.refreshFrameUrls;
}

beforeEach(() => {
  vi.mocked(getSignedUrl).mockClear();
});

describe('refreshFrameUrls', () => {
  it('rewrites thumbnailUrl on every item that carries an s3Key', async () => {
    const refreshFrameUrls = await freshModule();
    const tabs = [
      {
        component: 'moment_track',
        props: {
          items: [
            { time: '0:30', s3Key: 'videos/abc/frames/30.jpg', thumbnailUrl: 'expired-1' },
            { time: '1:00', s3Key: 'videos/abc/frames/60.jpg', thumbnailUrl: 'expired-2' },
          ],
        },
      },
    ];
    await refreshFrameUrls(tabs);
    expect(tabs[0].props.items[0].thumbnailUrl).toBe(
      'https://signed.example.com/videos/abc/frames/30.jpg?sig=fresh',
    );
    expect(tabs[0].props.items[1].thumbnailUrl).toBe(
      'https://signed.example.com/videos/abc/frames/60.jpg?sig=fresh',
    );
  });

  it('rewrites both url and thumbnailUrl on gallery image objects', async () => {
    const refreshFrameUrls = await freshModule();
    const tabs = [
      {
        component: 'gallery',
        props: {
          images: [
            {
              s3Key: 'videos/xyz/frames/10.jpg',
              url: 'expired',
              thumbnailUrl: 'expired',
              caption: 'Moment at 0:10',
            },
          ],
        },
      },
    ];
    await refreshFrameUrls(tabs);
    expect(tabs[0].props.images[0].url).toBe(
      'https://signed.example.com/videos/xyz/frames/10.jpg?sig=fresh',
    );
    expect(tabs[0].props.images[0].thumbnailUrl).toBe(
      'https://signed.example.com/videos/xyz/frames/10.jpg?sig=fresh',
    );
    expect(tabs[0].props.images[0].caption).toBe('Moment at 0:10');
  });

  it('leaves items without s3Key untouched (pass-through)', async () => {
    const refreshFrameUrls = await freshModule();
    const tabs = [
      {
        component: 'moment_track',
        props: {
          items: [
            { time: '0:30', thumbnailUrl: 'unchanged' },
            { time: '1:00' },
          ],
        },
      },
    ];
    await refreshFrameUrls(tabs);
    expect(tabs[0].props.items[0].thumbnailUrl).toBe('unchanged');
    expect((tabs[0].props.items[1] as Record<string, unknown>).thumbnailUrl).toBeUndefined();
  });

  it('walks deeply nested structures', async () => {
    const refreshFrameUrls = await freshModule();
    const tabs = [
      {
        props: {
          sections: [
            { rows: [{ s3Key: 'videos/deep/frames/1.jpg' }] },
          ],
        },
      },
    ];
    await refreshFrameUrls(tabs);
    const target = (tabs[0].props.sections[0].rows[0] as Record<string, unknown>);
    expect(target.thumbnailUrl).toBe('https://signed.example.com/videos/deep/frames/1.jpg?sig=fresh');
  });

  it('returns early without calling the signer when input is empty or not an array', async () => {
    const refreshFrameUrls = await freshModule();
    await refreshFrameUrls([]);
    await refreshFrameUrls(null);
    await refreshFrameUrls(undefined);
    await refreshFrameUrls({ not: 'a tab list' });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('returns the same reference it was given', async () => {
    const refreshFrameUrls = await freshModule();
    const tabs = [{ props: { items: [{ s3Key: 'videos/x.jpg' }] } }];
    const result = await refreshFrameUrls(tabs);
    expect(result).toBe(tabs);
  });

  it('does not throw when individual sign operations fail', async () => {
    const refreshFrameUrls = await freshModule();
    vi.mocked(getSignedUrl).mockRejectedValueOnce(new Error('s3 down'));
    const tabs = [
      {
        props: {
          items: [
            { s3Key: 'videos/will-fail.jpg', thumbnailUrl: 'old' },
            { s3Key: 'videos/will-succeed.jpg', thumbnailUrl: 'old' },
          ],
        },
      },
    ];
    await expect(refreshFrameUrls(tabs)).resolves.not.toThrow();
    expect(tabs[0].props.items[0].thumbnailUrl).toBe('old');
    expect(tabs[0].props.items[1].thumbnailUrl).toBe(
      'https://signed.example.com/videos/will-succeed.jpg?sig=fresh',
    );
  });

  it('ignores s3Key values that do not start with the videos/ prefix', async () => {
    // Defense-in-depth: a leaked transcript or intermediate-artifact key must
    // not be turned into a presigned URL handed to the frontend.
    const refreshFrameUrls = await freshModule();
    const tabs = [
      {
        props: {
          items: [
            { s3Key: 'transcripts/abc.json', thumbnailUrl: 'unchanged' },
            { s3Key: '../../etc/passwd', thumbnailUrl: 'unchanged' },
            { s3Key: 'videos/abc/frames/1.jpg', thumbnailUrl: 'expired' },
          ],
        },
      },
    ];
    await refreshFrameUrls(tabs);
    expect(tabs[0].props.items[0].thumbnailUrl).toBe('unchanged');
    expect(tabs[0].props.items[1].thumbnailUrl).toBe('unchanged');
    expect(tabs[0].props.items[2].thumbnailUrl).toBe(
      'https://signed.example.com/videos/abc/frames/1.jpg?sig=fresh',
    );
  });

  it('does not stack-overflow on cyclic input', async () => {
    // Input is normally acyclic JSON, but defense-in-depth: a shared in-memory
    // subtree must not blow the walker. The WeakSet guard prevents revisits.
    const refreshFrameUrls = await freshModule();
    const cyclic: Record<string, unknown> = { s3Key: 'videos/cycle/frames/1.jpg', thumbnailUrl: 'old' };
    cyclic.self = cyclic;
    const tabs = [{ props: { items: [cyclic] } }];
    await expect(refreshFrameUrls(tabs)).resolves.not.toThrow();
    expect((tabs[0].props.items[0] as Record<string, unknown>).thumbnailUrl).toBe(
      'https://signed.example.com/videos/cycle/frames/1.jpg?sig=fresh',
    );
  });

  it('does not overwrite non-string thumbnailUrl/url sentinels (e.g. null)', async () => {
    const refreshFrameUrls = await freshModule();
    const tabs = [
      {
        props: {
          items: [{ s3Key: 'videos/abc/frames/1.jpg', thumbnailUrl: null, url: null }],
        },
      },
    ];
    await refreshFrameUrls(tabs);
    const item = tabs[0].props.items[0] as Record<string, unknown>;
    // null was a deliberate clearing — leave it alone.
    expect(item.thumbnailUrl).toBeNull();
    expect(item.url).toBeNull();
  });
});

describe('refreshFrameUrls — no S3 configured', () => {
  it('is a no-op when S3_BUCKET is empty', async () => {
    vi.doMock('../config.js', () => ({
      config: {
        S3_BUCKET: '',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: '',
        AWS_ENDPOINT_URL: '',
        FRAME_URL_TTL_SECONDS: 21600,
      },
    }));
    const refreshFrameUrls = await freshModule();
    const tabs = [{ props: { items: [{ s3Key: 'videos/x.jpg', thumbnailUrl: 'kept-as-is' }] } }];
    const result = await refreshFrameUrls(tabs);
    expect(result).toBe(tabs);
    expect((tabs[0].props.items[0] as Record<string, unknown>).thumbnailUrl).toBe('kept-as-is');
    expect(getSignedUrl).not.toHaveBeenCalled();
    vi.doUnmock('../config.js');
  });
});
