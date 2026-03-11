/**
 * Cross-tab link resolution rules.
 * Maps source tabs to potential target tabs with display labels.
 */

export interface LinkRule {
  sourceTab: string;
  targetTab: string;
  label: string;
  condition?: (tabs: string[]) => boolean;
}

export const LINK_RULES: LinkRule[] = [
  // Study / Education
  { sourceTab: 'concepts', targetTab: 'quizzes', label: 'Test your knowledge' },
  { sourceTab: 'concepts', targetTab: 'flashcards', label: 'Review with flashcards' },
  { sourceTab: 'quizzes', targetTab: 'concepts', label: 'Review concepts' },
  { sourceTab: 'flashcards', targetTab: 'quizzes', label: 'Take the quiz' },
  { sourceTab: 'overview', targetTab: 'exercises', label: 'Try the exercises' },
  { sourceTab: 'exercises', targetTab: 'concepts', label: 'Review key concepts' },

  // Recipe
  { sourceTab: 'overview', targetTab: 'steps', label: 'Start cooking' },
  { sourceTab: 'ingredients', targetTab: 'steps', label: 'Go to steps' },
  { sourceTab: 'steps', targetTab: 'nutrition', label: 'See nutrition facts' },
  { sourceTab: 'nutrition', targetTab: 'ingredients', label: 'Check ingredients' },

  // Travel / Trip
  { sourceTab: 'overview', targetTab: 'budget', label: 'View budget breakdown' },
  { sourceTab: 'overview', targetTab: 'itinerary', label: 'See the itinerary' },
  { sourceTab: 'itinerary', targetTab: 'budget', label: 'Check costs' },
  { sourceTab: 'budget', targetTab: 'itinerary', label: 'Back to itinerary' },
  { sourceTab: 'spots', targetTab: 'itinerary', label: 'See full itinerary' },

  // Workout / Fitness
  { sourceTab: 'overview', targetTab: 'workout', label: 'Start workout' },
  { sourceTab: 'workout', targetTab: 'overview', label: 'Review overview' },

  // Review / Verdict
  { sourceTab: 'overview', targetTab: 'verdict', label: 'Jump to verdict' },
  { sourceTab: 'verdict', targetTab: 'overview', label: 'Read full review' },

  // General
  { sourceTab: 'overview', targetTab: 'highlights', label: 'See highlights' },
];

/**
 * Given an array of active tab IDs, returns a map of sourceTab -> applicable link rules.
 * Only includes rules where both source and target tabs exist in the active tabs.
 */
export function resolveCrossTabLinks(tabIds: string[]): Record<string, LinkRule[]> {
  const tabSet = new Set(tabIds);
  const result: Record<string, LinkRule[]> = {};

  for (const rule of LINK_RULES) {
    if (!tabSet.has(rule.sourceTab) || !tabSet.has(rule.targetTab)) continue;
    if (rule.condition && !rule.condition(tabIds)) continue;

    if (!result[rule.sourceTab]) {
      result[rule.sourceTab] = [];
    }
    result[rule.sourceTab].push(rule);
  }

  return result;
}
