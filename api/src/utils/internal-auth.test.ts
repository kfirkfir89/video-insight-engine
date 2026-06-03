import { describe, it, expect } from 'vitest';
import { isValidInternalSecret } from './internal-auth.js';
import { config } from '../config.js';

describe('isValidInternalSecret', () => {
  it('should return true when the header matches the configured secret', () => {
    expect(isValidInternalSecret(config.INTERNAL_SECRET)).toBe(true);
  });

  it('should return false when the header does not match', () => {
    expect(isValidInternalSecret('wrong-secret')).toBe(false);
  });

  it('should return false when the header is undefined', () => {
    expect(isValidInternalSecret(undefined)).toBe(false);
  });

  it('should return false when the header is an empty string', () => {
    expect(isValidInternalSecret('')).toBe(false);
  });

  it('should return false when the header is an array (never trust duplicated headers)', () => {
    expect(isValidInternalSecret([config.INTERNAL_SECRET])).toBe(false);
  });

  it('should return false for a correct prefix that is shorter than the secret', () => {
    expect(isValidInternalSecret(config.INTERNAL_SECRET.slice(0, -1))).toBe(false);
  });
});
