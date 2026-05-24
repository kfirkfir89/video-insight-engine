import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as cache from '../soft-delete-cache.js';

describe('soft-delete-cache', () => {
  beforeEach(() => {
    cache._resetForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null on miss', () => {
    expect(cache.get('user-1')).toBeNull();
  });

  it('returns the cached value within the TTL window', () => {
    cache.set('user-1', false);
    expect(cache.get('user-1')).toBe(false);
    cache.set('user-2', true);
    expect(cache.get('user-2')).toBe(true);
  });

  it('expires entries after 30 seconds', () => {
    cache.set('user-1', false);
    vi.advanceTimersByTime(29_999);
    expect(cache.get('user-1')).toBe(false);
    vi.advanceTimersByTime(2);
    expect(cache.get('user-1')).toBeNull();
  });

  it('invalidate drops an entry immediately', () => {
    cache.set('user-1', false);
    cache.invalidate('user-1');
    expect(cache.get('user-1')).toBeNull();
  });

  it('invalidate is a no-op on a missing key', () => {
    expect(() => cache.invalidate('never-cached')).not.toThrow();
  });

  it('set overwrites the previous value and TTL', () => {
    cache.set('user-1', false);
    vi.advanceTimersByTime(20_000);
    cache.set('user-1', true);
    // Refreshed TTL — should still be there 25s after the second set.
    vi.advanceTimersByTime(25_000);
    expect(cache.get('user-1')).toBe(true);
  });

  it('_resetForTests clears every entry', () => {
    cache.set('a', false);
    cache.set('b', true);
    cache._resetForTests();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });
});
