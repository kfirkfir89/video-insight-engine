import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * Constant-time comparison of a request's `x-admin-key` header against the
 * configured admin API key. A plain `!==` short-circuits on the first differing
 * byte, leaking the key one character at a time via response timing; this
 * compares the full buffers in constant time. The length guard runs first
 * because `timingSafeEqual` throws on unequal-length buffers — leaking the
 * key's length is far less sensitive than leaking its contents.
 */
export function isValidAdminKey(headerValue: string | string[] | undefined): boolean {
  const provided = Buffer.from(Array.isArray(headerValue) ? '' : headerValue ?? '');
  const expected = Buffer.from(config.ADMIN_API_KEY);
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
