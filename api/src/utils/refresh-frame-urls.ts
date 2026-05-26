import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { config } from '../config.js';

interface FrameRefSite {
  obj: Record<string, unknown>;
  s3Key: string;
}

interface SignerHandle {
  client: S3Client;
  bucket: string;
  ttl: number;
}

let cachedSigner: SignerHandle | null | undefined;

function getSigner(): SignerHandle | null {
  if (cachedSigner !== undefined) return cachedSigner;

  if (!config.S3_BUCKET) {
    cachedSigner = null;
    return null;
  }

  const clientOptions: ConstructorParameters<typeof S3Client>[0] = {
    region: config.AWS_REGION,
  };
  if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
    clientOptions.credentials = {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    };
  }
  if (config.AWS_ENDPOINT_URL) {
    clientOptions.endpoint = config.AWS_ENDPOINT_URL;
    clientOptions.forcePathStyle = true;
  }

  cachedSigner = {
    client: new S3Client(clientOptions),
    bucket: config.S3_BUCKET,
    ttl: config.FRAME_URL_TTL_SECONDS,
  };
  return cachedSigner;
}

// All real frame keys produced by the summarizer live under `videos/`. The
// prefix gate is defense-in-depth — if a future writer leaks a non-frame key
// (transcript JSON, intermediate artifact) into a frame slot, we don't hand
// the frontend a presigned URL to it.
const S3_KEY_PREFIX = 'videos/';

function collectSites(node: unknown, sink: FrameRefSite[], seen: WeakSet<object>): void {
  if (Array.isArray(node)) {
    if (seen.has(node)) return;
    seen.add(node);
    for (const child of node) collectSites(child, sink, seen);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  // Cycle guard: the input normally comes from JSON (acyclic), but an
  // accidentally-shared in-memory subtree would otherwise blow the stack.
  if (seen.has(node)) return;
  seen.add(node);

  const obj = node as Record<string, unknown>;
  const s3Key = obj.s3Key;
  if (typeof s3Key === 'string' && s3Key.startsWith(S3_KEY_PREFIX)) {
    sink.push({ obj, s3Key });
  }
  for (const value of Object.values(obj)) {
    collectSites(value, sink, seen);
  }
}

/**
 * Walks the assembled `tabs` tree and rewrites `thumbnailUrl`/`url` on every
 * object that carries an `s3Key` with a freshly-signed presigned URL.
 *
 * No-ops (returns the input unchanged) when S3 isn't configured or the input
 * doesn't look like a tab array — the API stays usable in tests and in dev
 * setups that don't have S3 credentials.
 *
 * Mutates in place AND returns the same reference for ergonomics.
 */
export async function refreshFrameUrls(tabs: unknown): Promise<unknown> {
  if (!Array.isArray(tabs) || tabs.length === 0) return tabs;
  const signer = getSigner();
  if (!signer) return tabs;

  const sites: FrameRefSite[] = [];
  collectSites(tabs, sites, new WeakSet());
  if (sites.length === 0) return tabs;

  const signedUrls = await Promise.all(
    sites.map(({ s3Key }) =>
      getSignedUrl(
        signer.client,
        new GetObjectCommand({ Bucket: signer.bucket, Key: s3Key }),
        { expiresIn: signer.ttl },
      ).catch(() => null),
    ),
  );

  for (let i = 0; i < sites.length; i++) {
    const url = signedUrls[i];
    if (!url) continue;
    const { obj } = sites[i];
    // Rewrite-if-string semantics: an existing string value gets refreshed.
    // Non-string sentinels (null, numbers, explicit undefined assignments) are
    // deliberate clearings — leave them alone.
    if (typeof obj.thumbnailUrl === 'string') obj.thumbnailUrl = url;
    if (typeof obj.url === 'string') obj.url = url;
    // When neither key was present at all, expose `thumbnailUrl` as the default —
    // every frontend consumer reads one of these two keys.
    if (!('thumbnailUrl' in obj) && !('url' in obj)) obj.thumbnailUrl = url;
  }
  return tabs;
}
