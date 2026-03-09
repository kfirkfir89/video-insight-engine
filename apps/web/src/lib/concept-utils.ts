/**
 * Shared concept name variant generation for matching concepts in content.
 *
 * Used by sidebar matching (timestamp-utils.ts).
 */

// Module-scope constants to avoid re-allocation per call
const GENERIC_SUFFIXES = ['feature', 'system', 'tool', 'technique', 'method', 'process', 'mechanism', 'language'];
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with', 'by']);
const ABBREVIATIONS: Record<string, string> = {
  env: 'environment', envs: 'environments',
  config: 'configuration', configs: 'configurations',
  dir: 'directory', dirs: 'directories',
  repo: 'repository', repos: 'repositories',
  auth: 'authentication', impl: 'implementation',
  dev: 'development', prod: 'production',
  deps: 'dependencies', dep: 'dependency',
  param: 'parameter', params: 'parameters',
  func: 'function', funcs: 'functions',
};
// Whitelist of verbs where -t → -tion is valid
const VERB_TO_NOUN_T = new Set([
  'correct', 'construct', 'destruct', 'extract', 'abstract', 'direct',
  'select', 'collect', 'connect', 'protect', 'restrict', 'instruct',
  'detect', 'reflect', 'inject', 'inspect', 'redirect', 'interact',
  'distract', 'subtract', 'react', 'compact', 'attract', 'disrupt',
]);
// Noun suffixes to skip during gerund addition (avoids noise like "dopamining")
const NOUN_SUFFIX_RE = /(?:ine|tion|sion|ment|ness|ance|ence|ity|ure|ous|ism|ist|ble|ful|less|ship)$/;
// Cap on total variants to keep regex manageable
const MAX_VARIANTS = 50;

/**
 * Generate search variants from a concept name to improve content matching.
 *
 * Handles:
 * - Full name lowercased
 * - Base name without trailing parenthetical (≥3 chars)
 * - Short abbreviation from parentheses (≤6 chars): "(SEO)" → "seo"
 * - Reversed pattern: short base + long parens content
 *   "EMDR (Eye Movement Desensitization Reprocessing)" → "emdr", "eye movement desensitization reprocessing"
 * - Slash parts: "Client/Server Architecture" → "client", "server"
 * - Hyphen/space swaps: "text to speech" → "text-to-speech", "auto-compaction" → "auto compaction"
 * - Plural form (append 's') and singular form (strip trailing 's')
 * - Strip generic suffix words: "rewind feature" → "rewind"
 * - Two-word substrings for 3+ word names: "initial root directory" → "root directory"
 * - Gerund addition: "engineer" → "engineering", "code" → "coding"
 *
 * @param name - The concept name to generate variants for
 * @param aliases - Optional LLM-provided aliases to prepend
 * @returns Array of lowercase search variant strings (deduplicated)
 */
export function getNameVariants(name: string, aliases?: string[]): string[] {
  if (!name || !name.trim()) return [];

  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (v: string) => {
    if (variants.length >= MAX_VARIANTS) return;
    const lower = v.toLowerCase().trim();
    if (lower.length > 0 && !seen.has(lower)) {
      seen.add(lower);
      variants.push(lower);
    }
  };

  // 0. Prepend aliases (LLM-provided short forms)
  if (aliases) {
    for (const alias of aliases) {
      add(alias);
    }
  }

  // 1. Full name lowercased
  add(name);

  // 2. Handle parenthetical patterns
  const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const baseName = parenMatch[1].trim();
    const parenContent = parenMatch[2].trim();

    if (parenContent.length <= 6) {
      // Standard: "Search Engine Optimization (SEO)" → base="Search Engine Optimization", abbr="SEO"
      if (baseName.length >= 3) add(baseName);
      add(parenContent);
    } else if (baseName.length <= 6) {
      // Reversed: "EMDR (Eye Movement Desensitization Reprocessing)" → base="EMDR", expanded from parens
      add(baseName);
      if (parenContent.length >= 3) add(parenContent);
    } else {
      // Both are long: "DPO analysis (Duration, Path, Outcome)" — add base only
      if (baseName.length >= 3) add(baseName);
    }
  }

  // 3. Slash parts: "Client/Server Architecture" or "A / B" → each part
  if (name.includes('/')) {
    const slashParts = name.split(/\s*\/\s*/);
    for (const part of slashParts) {
      const trimmed = part.trim();
      if (trimmed.length >= 3) add(trimmed);
    }
  }

  // 4. Hyphen ↔ space variants
  // "text to speech" → "text-to-speech", "dangerously-skip-permissions" → "dangerously skip permissions"
  if (name.includes(' ')) {
    add(name.replace(/\s+/g, '-'));
  }
  if (name.includes('-')) {
    add(name.replace(/-/g, ' '));
  }

  // 5. Plural variants: add 's' suffix to non-trivial variants
  const baseVariants = [...variants]; // snapshot before adding plurals
  for (const v of baseVariants) {
    if (v.length < 3) continue;
    if (!v.endsWith('s') && !v.endsWith('x') && !v.endsWith('z')) {
      add(v + 's');
    }
  }

  // 6. Singular form: strip trailing 's' for names ending in 's'
  for (const v of [...variants]) {
    if (v.length > 4 && v.endsWith('s') && !v.endsWith('ss')) {
      add(v.slice(0, -1));
    }
  }

  // 7. Strip generic trailing words: "rewind feature" → "rewind"
  const words = name.toLowerCase().split(/[\s-]+/);
  if (words.length >= 2 && GENERIC_SUFFIXES.includes(words[words.length - 1])) {
    add(words.slice(0, -1).join(' '));
  }

  // 8. Two-word substrings for 3+ word concepts: "initial root directory" → "initial root", "root directory"
  if (words.length >= 3) {
    for (let i = 0; i <= words.length - 2; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
      const pair = words[i] + ' ' + words[i + 1];
      if (pair.length >= 5) add(pair);
    }
  }

  // 9. Individual word fallback for names where ALL two-word pairs are stop-word blocked
  if (words.length >= 3) {
    const hasValidPair = (() => {
      for (let i = 0; i <= words.length - 2; i++) {
        if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) return true;
      }
      return false;
    })();

    if (!hasValidPair) {
      for (const w of words) {
        if (!STOP_WORDS.has(w) && w.length >= 8) add(w);
      }
    }
  }

  // 10. Gerund stripping: "escaping" → "escape", "running" → "run"
  // For multi-word concepts, only add full-phrase replacements (not standalone stems)
  const isSingleWord = words.length === 1;
  for (const w of words) {
    if (w.length >= 6 && w.endsWith('ing')) {
      const stem = w.slice(0, -3);
      if (stem.length >= 3) {
        // Pattern: stem + e → "escaping" → "escape"
        if (isSingleWord) add(stem + 'e');
        add(name.toLowerCase().replace(w, stem + 'e'));
        // Double-consonant pattern: "running" → "run", "setting" → "set"
        if (stem.length >= 4 && stem[stem.length - 1] === stem[stem.length - 2]) {
          if (isSingleWord) add(stem.slice(0, -1));
          add(name.toLowerCase().replace(w, stem.slice(0, -1)));
        }
      }
    }
  }

  // 10b. Gerund addition: "engineer" → "engineering", "code" → "coding"
  // Reverse of step 10: given a non-gerund word, produce the -ing form.
  // Skip common noun suffixes to avoid noise like "dopamining", "architecturing".
  for (const w of words) {
    if (w.length < 4 || w.endsWith('ing')) continue;
    if (NOUN_SUFFIX_RE.test(w)) continue;

    let gerund: string;
    if (w.endsWith('e') && !w.endsWith('ee') && !w.endsWith('oe') && !w.endsWith('ye')) {
      gerund = w.slice(0, -1) + 'ing'; // "code" → "coding"
    } else {
      gerund = w + 'ing'; // "engineer" → "engineering"
    }

    if (isSingleWord) add(gerund);
    add(name.toLowerCase().replace(w, gerund));
  }

  // 11. Verb-to-noun suffix (whitelisted verbs only)
  for (const w of words) {
    if (w.length >= 5) {
      // -t → -tion: "correct" → "correction" (whitelist only)
      if (w.endsWith('t') && !w.endsWith('tion') && VERB_TO_NOUN_T.has(w)) {
        add(name.toLowerCase().replace(w, w + 'ion'));
      }
      // -te → -tion: "create" → "creation" (general pattern, safe)
      if (w.endsWith('te') && !w.endsWith('tion')) {
        add(name.toLowerCase().replace(w, w.slice(0, -2) + 'tion'));
      }
    }
  }

  // 12. Common abbreviation expansion
  let hasAbbreviation = false;
  for (const w of words) {
    const expansion = ABBREVIATIONS[w];
    if (expansion) {
      hasAbbreviation = true;
      add(name.toLowerCase().replace(w, expansion));
    }
  }
  // Also produce fully-expanded variant when multiple abbreviations present
  if (hasAbbreviation) {
    let fully = name.toLowerCase();
    for (const w of words) {
      const expansion = ABBREVIATIONS[w];
      if (expansion) fully = fully.replace(w, expansion);
    }
    add(fully);
  }

  return variants;
}
