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
      expect(variants).not.toContain('dopamining'); // noun suffix -ine skipped
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

    // ─────────────────────────────────────────────────────
    // Hyphen/space swaps
    // ─────────────────────────────────────────────────────

    it('should produce hyphenated variant from spaced name', () => {
      const variants = getNameVariants('text to speech');
      expect(variants).toContain('text to speech');
      expect(variants).toContain('text-to-speech');
    });

    it('should produce spaced variant from hyphenated name', () => {
      const variants = getNameVariants('auto-compaction');
      expect(variants).toContain('auto-compaction');
      expect(variants).toContain('auto compaction');
    });

    // ─────────────────────────────────────────────────────
    // Singular form stripping
    // ─────────────────────────────────────────────────────

    it('should strip trailing s for singular form', () => {
      const variants = getNameVariants('Trigger words');
      expect(variants).toContain('trigger words');
      expect(variants).toContain('trigger word'); // singular
    });

    it('should not produce invalid singular for names ending in ss', () => {
      const variants = getNameVariants('Congress');
      expect(variants).not.toContain('congres');
    });

    // ─────────────────────────────────────────────────────
    // Generic suffix stripping
    // ─────────────────────────────────────────────────────

    it('should strip generic suffix words', () => {
      const variants = getNameVariants('rewind feature');
      expect(variants).toContain('rewind feature');
      expect(variants).toContain('rewind');
    });

    it('should strip generic suffix "system"', () => {
      const variants = getNameVariants('validation system');
      expect(variants).toContain('validation');
    });

    it('should not strip non-generic last words', () => {
      const variants = getNameVariants('deep learning');
      // "learning" is not in the generic suffixes list
      expect(variants).not.toContain('deep');
    });

    // ─────────────────────────────────────────────────────
    // Two-word substrings
    // ─────────────────────────────────────────────────────

    it('should produce two-word substrings for 3+ word names', () => {
      const variants = getNameVariants('initial root directory');
      expect(variants).toContain('initial root');
      expect(variants).toContain('root directory');
    });

    it('should not produce two-word substrings for 2-word names', () => {
      const variants = getNameVariants('Cloud Code');
      // Only 2 words, no substrings needed
      expect(variants).not.toContain('cloud');
    });

    it('should skip stop-word-only pairs in two-word substrings', () => {
      const variants = getNameVariants('escaping the interrupts');
      // "the interrupts" should be skipped (starts with stop word "the")
      expect(variants).not.toContain('the interrupts');
      // But "escaping the" pair should also be skipped (ends with stop word)
      expect(variants).not.toContain('escaping the');
    });

    // ─────────────────────────────────────────────────────
    // Generic suffix: "language"
    // ─────────────────────────────────────────────────────

    it('should strip generic suffix "language"', () => {
      const variants = getNameVariants('DSL language');
      expect(variants).toContain('dsl');
    });

    // ─────────────────────────────────────────────────────
    // Individual word fallback
    // ─────────────────────────────────────────────────────

    it('should fall back to individual words when all two-word pairs are stop-word blocked', () => {
      const variants = getNameVariants('Screenshot and drag');
      // Both pairs "screenshot and" / "and drag" are blocked by stop word "and"
      // Fallback should add "screenshot" (10 chars >= 8)
      expect(variants).toContain('screenshot');
      // "drag" (4 chars) is too short even for fallback
      expect(variants).not.toContain('drag');
    });

    it('should not fall back to short individual words', () => {
      const variants = getNameVariants('quality of the product');
      // "product" (7) and "quality" (7) are under the 8-char minimum
      expect(variants).not.toContain('product');
      expect(variants).not.toContain('quality');
    });

    it('should not fall back to individual words when valid pairs exist', () => {
      const variants = getNameVariants('initial root directory');
      // "initial root" and "root directory" are valid pairs
      // Should NOT add "initial" as standalone fallback
      expect(variants).not.toContain('initial');
    });

    // ─────────────────────────────────────────────────────
    // Abbreviation expansion
    // ─────────────────────────────────────────────────────

    it('should expand common abbreviations', () => {
      const variants = getNameVariants('throwaway envs');
      expect(variants).toContain('throwaway environments');
    });

    it('should expand multiple abbreviations in compound name', () => {
      const variants = getNameVariants('dev config');
      expect(variants).toContain('development configuration');
    });

    // ─────────────────────────────────────────────────────
    // Gerund stripping
    // ─────────────────────────────────────────────────────

    it('should strip gerund to full-phrase form for multi-word concepts', () => {
      const variants = getNameVariants('escaping the interrupts');
      // Multi-word: standalone stem blocked, full phrase still works
      expect(variants).not.toContain('escape');
      expect(variants).toContain('escape the interrupts');
    });

    it('should strip gerund to standalone form for single-word concepts', () => {
      const variants = getNameVariants('escaping');
      expect(variants).toContain('escape');
    });

    it('should not produce standalone stem from multi-word gerund concept', () => {
      const variants = getNameVariants('making contributions');
      expect(variants).not.toContain('make');
      expect(variants).toContain('make contributions');
    });

    it('should not produce invalid stems for short -ing words', () => {
      const variants = getNameVariants('ping');
      // "ping" is only 4 chars, too short for gerund stripping (needs >= 6)
      expect(variants).not.toContain('pe');
    });

    // ─────────────────────────────────────────────────────
    // Gerund addition
    // ─────────────────────────────────────────────────────

    it('should add -ing to base form: "engineer" → "engineering"', () => {
      const variants = getNameVariants('engineer');
      expect(variants).toContain('engineering');
    });

    it('should add -ing in multi-word phrase: "social engineer" → "social engineering"', () => {
      const variants = getNameVariants('social engineer');
      expect(variants).toContain('social engineering');
    });

    it('should not produce standalone gerund for multi-word concepts', () => {
      const variants = getNameVariants('social engineer');
      expect(variants).not.toContain('engineering');
    });

    it('should drop silent -e before -ing: "code" → "coding"', () => {
      const variants = getNameVariants('code');
      expect(variants).toContain('coding');
    });

    it('should keep -ee ending: "free" → "freeing" (not "freing")', () => {
      const variants = getNameVariants('free');
      expect(variants).toContain('freeing');
      expect(variants).not.toContain('freing');
    });

    it('should skip words already ending in -ing', () => {
      const variants = getNameVariants('testing');
      expect(variants).not.toContain('testinging');
    });

    it('should skip words shorter than 4 chars for gerund addition', () => {
      const variants = getNameVariants('use');
      expect(variants).not.toContain('using');
    });

    it('should skip noun suffixes to avoid noise gerunds', () => {
      expect(getNameVariants('dopamine')).not.toContain('dopamining');       // -ine
      expect(getNameVariants('architecture')).not.toContain('architecturing'); // -ure
      expect(getNameVariants('abstraction')).not.toContain('abstractioning'); // -tion
      expect(getNameVariants('awareness')).not.toContain('awarenesing');     // -ness
    });

    // ─────────────────────────────────────────────────────
    // Verb-to-noun suffix
    // ─────────────────────────────────────────────────────

    it('should add -ion suffix for verb-to-noun: "course correct" → "course correction"', () => {
      const variants = getNameVariants('course correct');
      expect(variants).toContain('course correction');
    });

    it('should add -tion suffix for -te ending: "create" → "creation"', () => {
      const variants = getNameVariants('data create');
      expect(variants).toContain('data creation');
    });
  });
});
