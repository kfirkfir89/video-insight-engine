import { describe, it, expect } from 'vitest';
import { parseSourceLanguage } from '../source-language.js';

describe('parseSourceLanguage', () => {
  // Minimal valid block — matches the shape the summarizer's translation
  // phase writes (services/summarizer/.../translation.py builds exactly these
  // five fields; synthesis is derived from meta on the FE). Stored as a
  // fixture so multiple tests share canonical truth.
  const validBlock = {
    code: 'he',
    name: 'עברית',
    isRTL: true,
    tabs: [{ id: 'overview' }, { id: 'key_points' }],
    meta: { videoTitle: 'דוגמה' },
  };

  it('returns null when the value is null or undefined', () => {
    // Top-level tabs are always English-primary — `sourceLanguage` is only
    // present for non-English videos with a successful translation phase.
    expect(parseSourceLanguage(null)).toBeNull();
    expect(parseSourceLanguage(undefined)).toBeNull();
  });

  it('returns the parsed block when the shape is valid', () => {
    const result = parseSourceLanguage(validBlock);
    expect(result).not.toBeNull();
    expect(result?.code).toBe('he');
    expect(result?.isRTL).toBe(true);
    expect(result?.tabs).toHaveLength(2);
  });

  it('returns null when a required field is missing', () => {
    // Summarizer regression guard — a partial write surfaces as "no
    // translation" instead of leaking a half-typed block to the FE.
    const { isRTL: _omit, ...partial } = validBlock;
    expect(parseSourceLanguage(partial)).toBeNull();
  });

  it('returns null when isRTL is the wrong type', () => {
    // Type drift (e.g. summarizer accidentally writes a string "true") is
    // a hard rejection — the FE relies on `isRTL: boolean` for direction
    // routing and silently coercing strings would skip RTL layout.
    expect(parseSourceLanguage({ ...validBlock, isRTL: 'true' })).toBeNull();
  });

  it('returns null when tabs is not an array', () => {
    expect(parseSourceLanguage({ ...validBlock, tabs: 'not-an-array' })).toBeNull();
  });
});
