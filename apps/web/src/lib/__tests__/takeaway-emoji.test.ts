import { describe, it, expect } from 'vitest';
import { emojiForTakeaway } from '../takeaway-emoji';

describe('emojiForTakeaway', () => {
  it('should pick performance emoji for optimization-themed text', () => {
    expect(emojiForTakeaway('Optimize render paths for faster paints')).toBe('⚡');
  });

  it('should pick the warning emoji over performance when an avoid-cue is present', () => {
    // Specificity ordering matters: "avoid premature optimization" should
    // resolve to a warning, not an optimization signal.
    expect(emojiForTakeaway('Avoid premature optimization')).toBe('⚠️');
  });

  it('should pick the profiling emoji for measurement-themed text', () => {
    expect(emojiForTakeaway('Profile before refactoring to find true bottlenecks')).toBe('📊');
  });

  it('should pick the testing emoji for verification text', () => {
    expect(emojiForTakeaway('Always test edge cases with explicit asserts')).toBe('✅');
  });

  it('should pick the React emoji for framework-specific text', () => {
    expect(emojiForTakeaway('useState and useEffect have specific dependency rules')).toBe('⚛️');
  });

  it('should pick the security emoji for auth-themed text', () => {
    expect(emojiForTakeaway('Encrypt user credentials at rest')).toBe('🔒');
  });

  it('should pick the cooking emoji for recipe text', () => {
    expect(emojiForTakeaway('Saute the onions until translucent before adding stock')).toBe('🍳');
  });

  it('should pick the learning emoji for education-themed text', () => {
    expect(emojiForTakeaway('Understanding base cases is essential for recursion')).toBe('📚');
  });

  it('should fall back to the domain emoji when no keyword matches', () => {
    // No keyword should fire here, so the domain default takes over.
    expect(emojiForTakeaway('It depends on context', 'tech')).toBe('💻');
    expect(emojiForTakeaway('It depends on context', 'food')).toBe('🍳');
    expect(emojiForTakeaway('It depends on context', 'fitness')).toBe('💪');
  });

  it('should fall back to a generic insight bulb when neither keyword nor domain match', () => {
    expect(emojiForTakeaway('It depends on context')).toBe('💡');
  });

  it('should be case-insensitive', () => {
    expect(emojiForTakeaway('PROFILE BEFORE OPTIMIZING')).toBe('📊');
    expect(emojiForTakeaway('profile before optimizing')).toBe('📊');
  });
});
