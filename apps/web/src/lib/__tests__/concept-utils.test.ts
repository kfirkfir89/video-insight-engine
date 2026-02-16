import { describe, it, expect } from 'vitest';
import { getNameVariants } from '../concept-utils';

describe('concept-utils', () => {
  describe('getNameVariants', () => {
    // ─────────────────────────────────────────────────────
    // Standard parenthetical: "Full Name (ABBR)"
    // ─────────────────────────────────────────────────────

    it('should extract abbreviation from short parenthetical', () => {
      const variants = getNameVariants('Search Engine Optimization (SEO)');
      expect(variants).toContain('search engine optimization (seo)'); // full
      expect(variants).toContain('search engine optimization'); // base
      expect(variants).toContain('seo'); // abbreviation
    });

    it('should handle DPO-style long parenthetical', () => {
      const variants = getNameVariants('DPO analysis (Duration, Path, Outcome)');
      expect(variants).toContain('dpo analysis (duration, path, outcome)'); // full
      expect(variants).toContain('dpo analysis'); // base (both are long, base added)
      // Long parens content should NOT be added as abbreviation
      expect(variants).not.toContain('duration, path, outcome');
    });

    // ─────────────────────────────────────────────────────
    // Reversed parenthetical: "ABBR (Full Expansion)"
    // ─────────────────────────────────────────────────────

    it('should handle reversed parenthetical pattern', () => {
      const variants = getNameVariants('EMDR (Eye Movement Desensitization Reprocessing)');
      expect(variants).toContain('emdr (eye movement desensitization reprocessing)'); // full
      expect(variants).toContain('emdr'); // base (short)
      expect(variants).toContain('eye movement desensitization reprocessing'); // expanded from parens
    });

    // ─────────────────────────────────────────────────────
    // Slash separator
    // ─────────────────────────────────────────────────────

    it('should split on slash separator', () => {
      const variants = getNameVariants('Client/Server Architecture');
      expect(variants).toContain('client/server architecture'); // full
      expect(variants).toContain('client'); // slash part
      expect(variants).toContain('server architecture'); // slash part
    });

    it('should handle space-surrounded slash separator', () => {
      const variants = getNameVariants('Reputation Lists / Spam Houses');
      expect(variants).toContain('reputation lists / spam houses');
      expect(variants).toContain('reputation lists');
      expect(variants).toContain('spam houses');
    });

    // ─────────────────────────────────────────────────────
    // Plural variants
    // ─────────────────────────────────────────────────────

    it('should add plural variant', () => {
      const variants = getNameVariants('Neuroplasticity');
      expect(variants).toContain('neuroplasticity');
      expect(variants).toContain('neuroplasticitys'); // simple 's' append
    });

    it('should not add plural to names ending in s', () => {
      const variants = getNameVariants('Kubernetes');
      expect(variants).toContain('kubernetes');
      expect(variants).not.toContain('kubernetess');
    });

    it('should not add plural to names ending in x', () => {
      const variants = getNameVariants('Redux');
      expect(variants).toContain('redux');
      expect(variants).not.toContain('reduxs');
    });

    // ─────────────────────────────────────────────────────
    // Simple names
    // ─────────────────────────────────────────────────────

    it('should handle simple name without special patterns', () => {
      const variants = getNameVariants('Dopamine');
      expect(variants).toContain('dopamine');
      expect(variants).toContain('dopamines'); // plural
      expect(variants).toHaveLength(2);
    });

    // ─────────────────────────────────────────────────────
    // Edge cases
    // ─────────────────────────────────────────────────────

    it('should return empty array for empty string', () => {
      expect(getNameVariants('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      expect(getNameVariants('   ')).toEqual([]);
    });

    it('should not add short base name (< 3 chars) without parens', () => {
      const variants = getNameVariants('AI (Artificial Intelligence)');
      expect(variants).toContain('ai (artificial intelligence)');
      // "AI" is ≤ 6 chars (base is short), so reversed pattern: base added, parens added
      expect(variants).toContain('ai');
      expect(variants).toContain('artificial intelligence');
    });

    // ─────────────────────────────────────────────────────
    // Deduplication
    // ─────────────────────────────────────────────────────

    it('should deduplicate variants', () => {
      const variants = getNameVariants('Test');
      const unique = new Set(variants);
      expect(variants.length).toBe(unique.size);
    });

    // ─────────────────────────────────────────────────────
    // Aliases
    // ─────────────────────────────────────────────────────

    it('should prepend aliases when provided', () => {
      const variants = getNameVariants('Duration, Path, and Outcome (DPO)', ['dpo', 'duration path outcome']);
      // Aliases come first
      expect(variants[0]).toBe('dpo');
      expect(variants[1]).toBe('duration path outcome');
      // Then normal variants
      expect(variants).toContain('duration, path, and outcome (dpo)');
    });

    it('should deduplicate aliases against computed variants', () => {
      const variants = getNameVariants('Search Engine Optimization (SEO)', ['seo']);
      // "seo" from alias and from parenthetical — should only appear once
      const seoCount = variants.filter(v => v === 'seo').length;
      expect(seoCount).toBe(1);
    });
  });
});
