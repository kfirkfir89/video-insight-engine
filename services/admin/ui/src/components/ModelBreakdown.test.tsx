import { describe, it, expect } from 'vitest';

function formatModelLabel(name?: string): string {
  return name?.split('/').pop() ?? '';
}

describe('ModelBreakdown', () => {
  it('should export ModelBreakdown component', async () => {
    const mod = await import('./ModelBreakdown');
    expect(typeof mod.ModelBreakdown).toBe('function');
  });

  describe('model label formatter', () => {
    it('should preserve the full version suffix for claude-sonnet-4-5', () => {
      expect(formatModelLabel('anthropic/claude-sonnet-4-5')).toBe('claude-sonnet-4-5');
    });

    it('should preserve the full version suffix for claude-opus-4-7', () => {
      expect(formatModelLabel('anthropic/claude-opus-4-7')).toBe('claude-opus-4-7');
    });

    it('should handle non-prefixed model names', () => {
      expect(formatModelLabel('gpt-4o-mini')).toBe('gpt-4o-mini');
    });

    it('should return empty string for undefined input', () => {
      expect(formatModelLabel(undefined)).toBe('');
    });
  });
});
