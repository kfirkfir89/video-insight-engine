/**
 * URL utilities for safe rendering.
 *
 * Issue #5: XSS prevention - validates URL protocols before rendering.
 */

/**
 * Validate URL has safe protocol (http/https only).
 * Returns sanitized URL or null if unsafe.
 *
 * Prevents XSS attacks via javascript: or other dangerous protocols.
 *
 * @example
 * ```ts
 * sanitizeUrl('https://example.com') // 'https://example.com'
 * sanitizeUrl('javascript:alert(1)') // null
 * sanitizeUrl('invalid-url') // null
 * ```
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is safe for rendering.
 * Convenience boolean version of sanitizeUrl.
 */
export function isSafeUrl(url: string): boolean {
  return sanitizeUrl(url) !== null;
}
