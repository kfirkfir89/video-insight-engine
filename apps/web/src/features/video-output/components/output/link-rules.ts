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
  { sourceTab: 'scenarios', targetTab: 'concepts', label: 'Review concepts' },

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
  { sourceTab: 'itinerary', targetTab: 'packing', label: 'Check packing list' },

  // Workout / Fitness
  { sourceTab: 'overview', targetTab: 'workout', label: 'Start workout' },
  { sourceTab: 'workout', targetTab: 'overview', label: 'Review overview' },
  { sourceTab: 'exercises', targetTab: 'tips', label: 'View tips' },

  // Review / Verdict
  { sourceTab: 'overview', targetTab: 'verdict', label: 'Jump to verdict' },
  { sourceTab: 'verdict', targetTab: 'overview', label: 'Read full review' },
  { sourceTab: 'verdict', targetTab: 'pros_cons', label: 'See pros & cons' },
  { sourceTab: 'pros_cons', targetTab: 'specs', label: 'View specs' },

  // Music
  { sourceTab: 'overview', targetTab: 'lyrics', label: 'View lyrics' },
  { sourceTab: 'lyrics', targetTab: 'analysis', label: 'Musical analysis' },
  { sourceTab: 'analysis', targetTab: 'structure', label: 'Song structure' },

  // Tech / Code
  { sourceTab: 'overview', targetTab: 'code', label: 'See code examples' },
  { sourceTab: 'code', targetTab: 'cheat_sheet', label: 'View cheat sheet' },
  { sourceTab: 'cheat_sheet', targetTab: 'patterns', label: 'See patterns' },

  // Project
  { sourceTab: 'overview', targetTab: 'materials', label: 'Check materials' },
  { sourceTab: 'materials', targetTab: 'steps', label: 'Start building' },

  // General
  { sourceTab: 'overview', targetTab: 'highlights', label: 'See highlights' },
  { sourceTab: 'key_points', targetTab: 'takeaways', label: 'Key takeaways' },
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
