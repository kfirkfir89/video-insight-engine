/**
 * Shared image host allowlist — single source of truth.
 *
 * Both SSE validation (sse-validators.ts) and component rendering
 * (VisualBlock.tsx) import from here to avoid duplicating the IIFE.
 */
export const PRODUCTION_IMAGE_HOSTS = [
  'img.youtube.com',
  'i.ytimg.com',
  'i3.ytimg.com',
] as const;

/**
 * Full allowed-host set including environment-specific hosts.
 * Includes localhost in DEV mode and the VITE_FRAMES_HOST env var.
 */
export const ALLOWED_IMAGE_HOSTS: Set<string> = (() => {
  const hosts = new Set<string>(PRODUCTION_IMAGE_HOSTS);
  if (import.meta.env.DEV) hosts.add('localhost');
  const framesHost = import.meta.env.VITE_FRAMES_HOST;
  if (typeof framesHost === 'string' && framesHost) hosts.add(framesHost);
  return hosts;
})();

/**
 * The configured S3 bucket name, used to restrict image URLs to our own bucket.
 * Falls back to the default bucket if VITE_S3_BUCKET is not set.
 */
const S3_BUCKET = import.meta.env.VITE_S3_BUCKET || 'vie-transcripts';

/**
 * Check if a hostname is an allowed AWS S3 host for our bucket.
 *
 * SECURITY: Only allows virtual-hosted style URLs for our configured bucket
 * (e.g., vie-transcripts.s3.us-east-1.amazonaws.com). This prevents accepting
 * URLs from arbitrary third-party S3 buckets while remaining deployment-agnostic
 * via the VITE_S3_BUCKET env var.
 */
export function isAllowedS3Host(hostname: string): boolean {
  return hostname.startsWith(`${S3_BUCKET}.`) &&
    /\.s3(\.[-a-z0-9]+)?\.amazonaws\.com$/.test(hostname);
}

/**
 * Check if a full URL points to an allowed image host.
 * Validates protocol (https required, http allowed in DEV) and hostname.
 */
export function isAllowedImageHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:')) return false;
    return ALLOWED_IMAGE_HOSTS.has(parsed.hostname) || isAllowedS3Host(parsed.hostname);
  } catch {
    return false;
  }
}
