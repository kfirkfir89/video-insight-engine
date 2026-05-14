import type { ContentTag } from '@vie/types';

// Keyword-regex ladder: the FIRST matching pattern wins. Order is meaningful —
// put more specific intents (warn/avoid, optimization) ahead of general nouns
// (data, learn) so a takeaway like "avoid premature optimization" resolves to
// ⚠️ instead of ⚡.
const KEYWORD_EMOJI: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(warn|avoid|caref|danger|pitfall|trap|mistake|wrong|fail|crash|exception|bug)/i, '⚠️'],
  [/\b(test|verify|validat|assert|specs?\b|coverage)/i, '✅'],
  [/\b(secur|safe|auth|protect|encrypt|sanitiz|vulnerab)/i, '🔒'],
  [/\b(profile|measure|monitor|metric|benchmark|analyz|observ)/i, '📊'],
  [/\b(optimiz|performance|speed|latenc|throughput|cache|faster)/i, '⚡'],
  [/\b(split|modular|chunk|break\s*down|divid|separat|isolat|decoupl)/i, '🧩'],
  [/\b(memo|memoiz|persist|stor)/i, '🪝'],
  [/\b(react|component|hook|usestate|useeffect|prop|jsx|tsx)/i, '⚛️'],
  [/\b(server|backend|api|endpoint|route|fastify|express)/i, '🌐'],
  [/\b(database|query|sql|index|schema|mongo|postgres)/i, '🗄️'],
  [/\b(money|cost|price|budget|invest|saving|expense)/i, '💰'],
  [/\b(deadline|schedul|quick|delay|wait|timing)/i, '⏱️'],
  [/\b(grow|scale|expand|increas|improve|leverage|amplif)/i, '📈'],
  [/\b(idea|insight|innov|creat|discover|reveal|realiz)/i, '💡'],
  [/\b(team|collab|togeth|community|stakehold)/i, '👥'],
  [/\b(automat|tool|script|workflow|pipeline|ci\/cd)/i, '🛠️'],
  [/\b(recipe|cook|ingredient|bake|flavor|saute|simmer)/i, '🍳'],
  [/\b(exercis|workout|train|muscle|cardio|rep|set)/i, '💪'],
  [/\b(travel|trip|destinat|tour|journey|flight|hotel)/i, '✈️'],
  [/\b(music|song|lyric|melod|chord|rhythm|harmon)/i, '🎵'],
  [/\b(visual|render|paint|draw|design|layout|aesthet)/i, '🎨'],
  [/\b(learn|teach|stud|knowledge|understand|grasp|comprehen)/i, '📚'],
  [/\b(key|important|critical|essential|core|primary|main)/i, '🎯'],
  [/\b(read|book|article|chapter|page|note)/i, '📖'],
];

const DOMAIN_FALLBACK: Record<string, string> = {
  learning: '📚',
  tech: '💻',
  food: '🍳',
  travel: '✈️',
  fitness: '💪',
  music: '🎵',
  review: '⭐',
  project: '🛠️',
  language: '🗣️',
  science: '🔬',
  narrative: '📖',
};

/** Pick a contextual emoji for a key-takeaway string. Frontend-only — the
 *  backend doesn't emit per-takeaway emoji today, and we don't want to
 *  invalidate cached videos by adding a new emission. Falls back to the
 *  primaryTag's domain default, then a generic insight bulb. */
export function emojiForTakeaway(text: string, primaryTag?: ContentTag): string {
  for (const [regex, emoji] of KEYWORD_EMOJI) {
    if (regex.test(text)) return emoji;
  }
  return (primaryTag && DOMAIN_FALLBACK[primaryTag]) ?? '💡';
}
