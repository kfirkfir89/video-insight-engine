/**
 * Centralized block labels for i18n readiness.
 * All user-facing strings in one place for future translation.
 */
export const BLOCK_LABELS = {
  // Comparison blocks
  pros: 'Pros',
  cons: 'Cons',
  dos: 'Do',
  donts: "Don't",
  before: 'Before',
  after: 'After',

  // Recipe blocks
  ingredients: 'Ingredients',
  steps: 'Steps',
  nutrition: 'Nutrition Facts',
  servings: 'Servings',
  perServing: 'Per Serving',

  // Code blocks
  copyCode: 'Copy code',
  copied: 'Copied!',
  terminal: 'Terminal',
  output: 'Output',

  // Review blocks
  verdict: 'Verdict',
  recommended: 'Recommended',
  notRecommended: 'Not Recommended',
  conditional: 'Conditional',
  neutral: 'Neutral',
  bestFor: 'Best For',
  notFor: 'Not For',

  // Rating
  rating: (n: number, max: number) => `Rating: ${n} out of ${max}`,
  ratingStars: (n: number, max: number) => `${n} out of ${max} stars`,

  // Fitness blocks
  exercises: 'Exercises',
  sets: 'Sets',
  reps: 'Reps',
  duration: 'Duration',
  rest: 'Rest',
  difficulty: 'Difficulty',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  workoutTimer: 'Workout Timer',
  work: 'Work',
  warmup: 'Warm Up',
  cooldown: 'Cool Down',
  rounds: 'Rounds',
  complete: 'Complete!',
  totalTime: 'Total time',
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  reset: 'Reset',

  // Travel blocks
  location: 'Location',
  itinerary: 'Itinerary',
  day: 'Day',
  costs: 'Costs',
  total: 'Total',
  viewOnMap: 'View on Map',

  // Education blocks
  quiz: 'Quiz',
  question: 'Question',
  answer: 'Answer',
  showAnswer: 'Show Answer',
  hideAnswer: 'Hide Answer',
  correct: 'Correct',
  incorrect: 'Incorrect',
  explanation: 'Explanation',
  formula: 'Formula',

  // Podcast blocks
  guests: 'Guests',
  host: 'Host',
  bio: 'Bio',

  // Timeline
  timeline: 'Timeline',

  // Tools
  tools: 'Tools & Equipment',
  required: 'Required',
  optional: 'Optional',

  // Transcript
  transcript: 'Transcript',
  jumpTo: 'Jump to',

  // General
  showMore: 'Show more',
  showLess: 'Show less',
  expand: 'Expand',
  collapse: 'Collapse',
  loading: 'Loading...',
  error: 'Error',
  empty: 'No content available',
} as const;

export type BlockLabelKey = keyof typeof BLOCK_LABELS;
