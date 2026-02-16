/**
 * Shared concept name variant generation for matching concepts in content.
 *
 * Used by both sidebar matching (timestamp-utils.ts) and inline
 * highlighting (ConceptHighlighter.tsx) to ensure consistent behavior.
 */

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
 * - Simple plural form (append 's')
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

  // 4. Plural variants: add 's' suffix to non-trivial variants
  const baseVariants = [...variants]; // snapshot before adding plurals
  for (const v of baseVariants) {
    if (v.length < 3) continue;
    if (!v.endsWith('s') && !v.endsWith('x') && !v.endsWith('z')) {
      add(v + 's');
    }
  }

  return variants;
}
