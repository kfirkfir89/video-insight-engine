import { describe, it, expect } from 'vitest';
import { isRTL, directionFor, RTL_LANGUAGES } from '../rtl';

describe('isRTL', () => {
  it('should return true for Hebrew', () => {
    expect(isRTL('he')).toBe(true);
  });

  it('should return true for Arabic', () => {
    expect(isRTL('ar')).toBe(true);
  });

  it('should return true for Persian (fa)', () => {
    expect(isRTL('fa')).toBe(true);
  });

  it('should return true for Urdu (ur)', () => {
    expect(isRTL('ur')).toBe(true);
  });

  it('should return false for English', () => {
    expect(isRTL('en')).toBe(false);
  });

  it('should return false for null/undefined/empty', () => {
    expect(isRTL(null)).toBe(false);
    expect(isRTL(undefined)).toBe(false);
    expect(isRTL('')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isRTL('HE')).toBe(true);
    expect(isRTL('Ar')).toBe(true);
  });

  it('should return false for unknown codes', () => {
    expect(isRTL('xx')).toBe(false);
    expect(isRTL('zz')).toBe(false);
  });
});

describe('directionFor', () => {
  it('should return "rtl" for RTL languages', () => {
    expect(directionFor('he')).toBe('rtl');
    expect(directionFor('ar')).toBe('rtl');
  });

  it('should return "ltr" for LTR languages and unknowns', () => {
    expect(directionFor('en')).toBe('ltr');
    expect(directionFor('es')).toBe('ltr');
    expect(directionFor(null)).toBe('ltr');
  });
});

describe('RTL_LANGUAGES', () => {
  it('should contain the canonical RTL ISO 639-1 codes', () => {
    for (const code of ['he', 'ar', 'fa', 'ur']) {
      expect(RTL_LANGUAGES.has(code)).toBe(true);
    }
  });
});
