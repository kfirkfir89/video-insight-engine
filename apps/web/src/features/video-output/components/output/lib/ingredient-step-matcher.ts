/**
 * Ingredient-to-step text matching utility.
 * Matches ingredient names to step instructions for cross-tab readiness display.
 */

const QUALIFIERS = new Set([
  'fresh', 'large', 'small', 'medium', 'dried', 'ground', 'minced',
  'chopped', 'sliced', 'diced', 'grated', 'shredded', 'melted',
  'softened', 'frozen', 'canned', 'organic', 'raw', 'cooked',
  'warm', 'cold', 'hot', 'fine', 'coarse', 'whole', 'half',
  'thin', 'thick', 'boneless', 'skinless', 'peeled', 'crushed',
  'toasted', 'roasted', 'unsalted', 'salted', 'extra-virgin',
  'low-fat', 'full-fat', 'reduced-fat',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract primary noun tokens from an ingredient name, stripping qualifiers.
 * e.g. "fresh chicken breast" → ["chicken", "breast"]
 */
export function getMatchTokens(ingredientName: string): string[] {
  const words = ingredientName
    .toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const tokens = words.filter(w => !QUALIFIERS.has(w));
  return tokens.length > 0 ? tokens : words;
}

/** Pre-compiled regex cache to avoid allocation in nested loops. */
const regexCache = new Map<string, RegExp>();

function getTokenRegex(token: string): RegExp {
  let regex = regexCache.get(token);
  if (!regex) {
    regex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
    regexCache.set(token, regex);
  }
  return regex;
}

/**
 * Check if any match token appears as a word boundary match in the step instruction.
 */
function tokensMatchText(tokens: string[], text: string): boolean {
  const lower = text.toLowerCase();
  return tokens.some(token => getTokenRegex(token).test(lower));
}

/**
 * Match ingredients to a specific step instruction.
 * Returns which ingredients are referenced in the step and how many are checked.
 */
export function matchIngredientsToStep(
  stepInstruction: string,
  ingredients: Array<{ label: string }>,
  checkedIndices: Set<number>,
): { total: number; checked: number; matchedIndices: number[] } {
  const matchedIndices: number[] = [];

  for (let i = 0; i < ingredients.length; i++) {
    const tokens = getMatchTokens(ingredients[i].label);
    if (tokensMatchText(tokens, stepInstruction)) {
      matchedIndices.push(i);
    }
  }

  const checked = matchedIndices.filter(i => checkedIndices.has(i)).length;
  return { total: matchedIndices.length, checked, matchedIndices };
}

/**
 * Pre-compute mapping: stepIndex → ingredientIndices[].
 * Computed once, memoized by caller with useMemo.
 */
export function buildStepIngredientMap(
  steps: Array<{ instruction: string }>,
  ingredients: Array<{ label: string }>,
): Map<number, number[]> {
  const map = new Map<number, number[]>();

  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const matched: number[] = [];
    for (let ingIdx = 0; ingIdx < ingredients.length; ingIdx++) {
      const tokens = getMatchTokens(ingredients[ingIdx].label);
      if (tokensMatchText(tokens, steps[stepIdx].instruction)) {
        matched.push(ingIdx);
      }
    }
    if (matched.length > 0) {
      map.set(stepIdx, matched);
    }
  }

  return map;
}
