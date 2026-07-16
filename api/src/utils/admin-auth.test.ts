import { describe, it, expect } from 'vitest';
import { isValidAdminKey } from './admin-auth.js';
import { config } from '../config.js';

describe('isValidAdminKey', () => {
  it('should return true when the header matches the configured admin key', () => {
    expect(isValidAdminKey(config.ADMIN_API_KEY)).toBe(true);
  });

  it('should return false when the header does not match', () => {
    expect(isValidAdminKey('wrong-key')).toBe(false);
  });

  it('should return false when the header is undefined', () => {
    expect(isValidAdminKey(undefined)).toBe(false);
  });

  it('should return false when the header is an empty string', () => {
    expect(isValidAdminKey('')).toBe(false);
  });

  it('should return false when the header is an array (never trust duplicated headers)', () => {
    expect(isValidAdminKey([config.ADMIN_API_KEY])).toBe(false);
  });

  it('should return false for a correct prefix that is shorter than the key', () => {
    expect(isValidAdminKey(config.ADMIN_API_KEY.slice(0, -1))).toBe(false);
  });

  it('should return false for a same-length key that differs in one byte', () => {
    const flipped = `${config.ADMIN_API_KEY.slice(0, -1)}#`;
    expect(isValidAdminKey(flipped)).toBe(false);
  });
});
