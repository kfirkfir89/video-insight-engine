/**
 * Mock Block Factories for Dev Pages
 *
 * Factory functions for all 31 content block types.
 * Uses crypto.randomUUID() for stable block IDs.
 *
 * IMPORTANT: Dev-only module - tree-shaken in production.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('mock-blocks.ts should not be imported in production');
}

import type {
  ParagraphBlock,
  BulletsBlock,
  NumberedBlock,
  DoDoNotBlock,
  ExampleBlock,
  CalloutBlock,
  CalloutStyle,
  DefinitionBlock,
  KeyValueBlock,
  ComparisonBlock,
  TimestampBlock,
  QuoteBlock,
  StatisticBlock,
  TranscriptBlock,
  TimelineBlock,
  ToolListBlock,
  IngredientBlock,
  StepBlock,
  NutritionBlock,
  CodeBlock,
  TerminalBlock,
  FileTreeBlock,
  FileTreeNode,
  LocationBlock,
  ItineraryBlock,
  CostBlock,
  ProConBlock,
  RatingBlock,
  VerdictBlock,
  ExerciseBlock,
  WorkoutTimerBlock,
  QuizBlock,
  FormulaBlock,
  GuestBlock,
  ProblemSolutionBlock,
  VisualBlock,
  TableBlock,
} from '@vie/types';

// ─────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

// ─────────────────────────────────────────────────────
// Universal Blocks (12)
// ─────────────────────────────────────────────────────

export function createParagraphBlock(text: string): ParagraphBlock {
  return {
    blockId: uuid(),
    type: 'paragraph',
    text,
  };
}

export function createBulletsBlock(
  items: string[],
  variant?: 'ingredients' | 'checklist' | string
): BulletsBlock {
  return {
    blockId: uuid(),
    type: 'bullets',
    items,
    variant,
  };
}

export function createNumberedBlock(
  items: string[],
  variant?: 'cooking_steps' | string
): NumberedBlock {
  return {
    blockId: uuid(),
    type: 'numbered',
    items,
    variant,
  };
}

export function createDoDoNotBlock(doItems: string[], dontItems: string[]): DoDoNotBlock {
  return {
    blockId: uuid(),
    type: 'do_dont',
    do: doItems,
    dont: dontItems,
  };
}

export function createExampleBlock(
  code: string,
  title?: string,
  explanation?: string,
  variant?: 'terminal_command' | string
): ExampleBlock {
  return {
    blockId: uuid(),
    type: 'example',
    code,
    title,
    explanation,
    variant,
  };
}

export function createCalloutBlock(
  style: CalloutStyle,
  text: string,
  variant?: 'chef_tip' | string
): CalloutBlock {
  return {
    blockId: uuid(),
    type: 'callout',
    style,
    text,
    variant,
  };
}

export function createDefinitionBlock(term: string, meaning: string): DefinitionBlock {
  return {
    blockId: uuid(),
    type: 'definition',
    term,
    meaning,
  };
}

export function createKeyValueBlock(
  items: { key: string; value: string }[],
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location'
): KeyValueBlock {
  return {
    blockId: uuid(),
    type: 'keyvalue',
    items,
    variant,
  };
}

export function createComparisonBlock(
  left: { label: string; items: string[] },
  right: { label: string; items: string[] },
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after'
): ComparisonBlock {
  return {
    blockId: uuid(),
    type: 'comparison',
    left,
    right,
    variant,
  };
}

export function createTimestampBlock(
  time: string,
  seconds: number,
  label: string
): TimestampBlock {
  return {
    blockId: uuid(),
    type: 'timestamp',
    time,
    seconds,
    label,
  };
}

export function createQuoteBlock(
  text: string,
  attribution?: string,
  timestamp?: number,
  variant?: 'speaker' | 'testimonial' | 'highlight'
): QuoteBlock {
  return {
    blockId: uuid(),
    type: 'quote',
    text,
    attribution,
    timestamp,
    variant,
  };
}

export function createStatisticBlock(
  items: {
    value: string;
    label: string;
    context?: string;
    trend?: 'up' | 'down' | 'neutral';
  }[],
  variant?: 'metric' | 'percentage' | 'trend'
): StatisticBlock {
  return {
    blockId: uuid(),
    type: 'statistic',
    items,
    variant,
  };
}

// ─────────────────────────────────────────────────────
// New Universal Blocks (3)
// ─────────────────────────────────────────────────────

export function createTranscriptBlock(
  lines: { time: string; seconds: number; text: string }[]
): TranscriptBlock {
  return {
    blockId: uuid(),
    type: 'transcript',
    lines,
  };
}

export function createTimelineBlock(
  events: { date?: string; time?: string; title: string; description?: string }[]
): TimelineBlock {
  return {
    blockId: uuid(),
    type: 'timeline',
    events,
  };
}

export function createToolListBlock(
  tools: { name: string; quantity?: string; notes?: string; checked?: boolean }[]
): ToolListBlock {
  return {
    blockId: uuid(),
    type: 'tool_list',
    tools,
  };
}

// ─────────────────────────────────────────────────────
// Cooking Blocks (3)
// ─────────────────────────────────────────────────────

export function createIngredientBlock(
  items: { name: string; amount?: string; unit?: string; notes?: string; checked?: boolean }[],
  servings?: number
): IngredientBlock {
  return {
    blockId: uuid(),
    type: 'ingredient',
    items,
    servings,
  };
}

export function createStepBlock(
  steps: { number: number; instruction: string; duration?: number; tips?: string }[]
): StepBlock {
  return {
    blockId: uuid(),
    type: 'step',
    steps,
  };
}

export function createNutritionBlock(
  items: { nutrient: string; amount: string; unit?: string; dailyValue?: string }[],
  servingSize?: string
): NutritionBlock {
  return {
    blockId: uuid(),
    type: 'nutrition',
    items,
    servingSize,
  };
}

// ─────────────────────────────────────────────────────
// Coding Blocks (3)
// ─────────────────────────────────────────────────────

export function createCodeBlock(
  code: string,
  language?: string,
  filename?: string,
  highlightLines?: number[]
): CodeBlock {
  return {
    blockId: uuid(),
    type: 'code',
    code,
    language,
    filename,
    highlightLines,
  };
}

export function createTerminalBlock(command: string, output?: string): TerminalBlock {
  return {
    blockId: uuid(),
    type: 'terminal',
    command,
    output,
  };
}

export function createFileTreeBlock(tree: FileTreeNode[]): FileTreeBlock {
  return {
    blockId: uuid(),
    type: 'file_tree',
    tree,
  };
}

// ─────────────────────────────────────────────────────
// Travel Blocks (3)
// ─────────────────────────────────────────────────────

export function createLocationBlock(
  name: string,
  address?: string,
  description?: string,
  coordinates?: { lat: number; lng: number }
): LocationBlock {
  return {
    blockId: uuid(),
    type: 'location',
    name,
    address,
    description,
    coordinates,
  };
}

export function createItineraryBlock(
  days: {
    day: number;
    title?: string;
    activities: { time?: string; activity: string; location?: string; duration?: string; notes?: string }[];
  }[]
): ItineraryBlock {
  return {
    blockId: uuid(),
    type: 'itinerary',
    days,
  };
}

export function createCostBlock(
  items: { category: string; amount: number; notes?: string }[],
  total?: number,
  currency?: string
): CostBlock {
  return {
    blockId: uuid(),
    type: 'cost',
    items,
    total,
    currency,
  };
}

// ─────────────────────────────────────────────────────
// Review Blocks (3)
// ─────────────────────────────────────────────────────

export function createProConBlock(pros: string[], cons: string[]): ProConBlock {
  return {
    blockId: uuid(),
    type: 'pro_con',
    pros,
    cons,
  };
}

export function createRatingBlock(
  score: number,
  maxScore: number,
  label?: string,
  breakdown?: { category: string; score: number; maxScore?: number }[]
): RatingBlock {
  return {
    blockId: uuid(),
    type: 'rating',
    score,
    maxScore,
    label,
    breakdown,
  };
}

export function createVerdictBlock(
  verdict: 'recommended' | 'not_recommended' | 'conditional' | 'neutral',
  summary: string,
  bestFor?: string[],
  notFor?: string[]
): VerdictBlock {
  return {
    blockId: uuid(),
    type: 'verdict',
    verdict,
    summary,
    bestFor,
    notFor,
  };
}

// ─────────────────────────────────────────────────────
// Fitness Blocks (2)
// ─────────────────────────────────────────────────────

export function createExerciseBlock(
  exercises: {
    name: string;
    sets?: number;
    reps?: string;
    duration?: string;
    rest?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    notes?: string;
    timestamp?: number;
  }[]
): ExerciseBlock {
  return {
    blockId: uuid(),
    type: 'exercise',
    exercises,
  };
}

export function createWorkoutTimerBlock(
  intervals: { name: string; duration: number; type: 'work' | 'rest' | 'warmup' | 'cooldown' }[],
  rounds?: number
): WorkoutTimerBlock {
  return {
    blockId: uuid(),
    type: 'workout_timer',
    intervals,
    rounds,
  };
}

// ─────────────────────────────────────────────────────
// Education Blocks (2)
// ─────────────────────────────────────────────────────

export function createQuizBlock(
  questions: { question: string; options: string[]; correctIndex: number; explanation?: string }[]
): QuizBlock {
  return {
    blockId: uuid(),
    type: 'quiz',
    questions,
  };
}

export function createFormulaBlock(
  latex: string,
  description?: string,
  inline?: boolean
): FormulaBlock {
  return {
    blockId: uuid(),
    type: 'formula',
    latex,
    description,
    inline,
  };
}

// ─────────────────────────────────────────────────────
// Podcast Blocks (1)
// ─────────────────────────────────────────────────────

export function createGuestBlock(
  guests: {
    name: string;
    title?: string;
    bio?: string;
    imageUrl?: string;
    socialLinks?: { platform: string; url: string }[];
  }[]
): GuestBlock {
  return {
    blockId: uuid(),
    type: 'guest',
    guests,
  };
}

// ─────────────────────────────────────────────────────
// Generic Blocks (1)
// ─────────────────────────────────────────────────────

export function createTableBlock(
  columns: { key: string; label: string; align?: 'left' | 'center' | 'right' }[],
  rows: Record<string, string | number>[],
  caption?: string,
  highlightRows?: number[]
): TableBlock {
  return {
    blockId: uuid(),
    type: 'table',
    columns,
    rows,
    caption,
    highlightRows,
  };
}

// ─────────────────────────────────────────────────────
// Quality Blocks (2)
// ─────────────────────────────────────────────────────

export function createProblemSolutionBlock(
  problem: string,
  solution: string,
  context?: string
): ProblemSolutionBlock {
  return {
    blockId: uuid(),
    type: 'problem_solution',
    problem,
    solution,
    context,
  };
}

export function createVisualBlock(
  description: string,
  variant?: 'diagram' | 'screenshot' | 'demo' | 'whiteboard',
  timestamp?: number,
  label?: string
): VisualBlock {
  return {
    blockId: uuid(),
    type: 'visual',
    description,
    variant,
    timestamp,
    label,
  };
}

// ─────────────────────────────────────────────────────
// Sample Data for Showcase
// ─────────────────────────────────────────────────────

export const sampleBlocks = {
  // Universal blocks
  paragraph: createParagraphBlock(
    'This is a sample paragraph block. It contains regular text content that flows naturally across multiple lines when needed.'
  ),
  bullets: createBulletsBlock([
    'First bullet point',
    'Second bullet point with more detail',
    'Third bullet point',
  ]),
  numbered: createNumberedBlock([
    'First step in the process',
    'Second step builds on the first',
    'Third step completes the sequence',
  ]),
  do_dont: createDoDoNotBlock(
    ['Use semantic HTML elements', 'Write descriptive variable names', 'Test your code'],
    ['Use div soup', 'Use single-letter variables', 'Skip testing']
  ),
  example: createExampleBlock(
    'const greeting = "Hello, World!";\nconsole.log(greeting);',
    'Hello World Example',
    'This demonstrates basic JavaScript syntax'
  ),
  callout_tip: createCalloutBlock('tip', 'Pro tip: Always use TypeScript for better type safety.'),
  callout_warning: createCalloutBlock('warning', 'Warning: This action cannot be undone.'),
  callout_note: createCalloutBlock('note', 'Note: This feature is still in beta.'),
  callout_chef_tip: createCalloutBlock('chef_tip', "Chef's tip: Let the meat rest for 5 minutes before slicing."),
  callout_security: createCalloutBlock('security', 'Security: Never commit API keys to version control.'),
  definition: createDefinitionBlock(
    'React Hook',
    'A special function that lets you use state and other React features in functional components.'
  ),
  keyvalue: createKeyValueBlock([
    { key: 'Version', value: '2.0.0' },
    { key: 'License', value: 'MIT' },
    { key: 'Bundle Size', value: '45kb gzipped' },
  ]),
  comparison: createComparisonBlock(
    { label: 'React', items: ['Component-based', 'Virtual DOM', 'JSX syntax'] },
    { label: 'Vue', items: ['Template-based', 'Reactive system', 'SFC syntax'] },
    'versus'
  ),
  timestamp: createTimestampBlock('5:23', 323, 'Key moment: Introduction to hooks'),
  quote: createQuoteBlock(
    'The best way to predict the future is to invent it.',
    'Alan Kay',
    undefined,
    'speaker'
  ),
  statistic: createStatisticBlock([
    { value: '85%', label: 'Performance Gain', trend: 'up' },
    { value: '3.2x', label: 'Faster Build Time', trend: 'up' },
    { value: '40%', label: 'Bundle Reduction', trend: 'down' },
  ]),

  // New universal blocks
  transcript: createTranscriptBlock([
    { time: '0:00', seconds: 0, text: 'Welcome to this tutorial.' },
    { time: '0:05', seconds: 5, text: "Today we'll learn about React hooks." },
    { time: '0:12', seconds: 12, text: "Let's start with useState." },
  ]),
  timeline: createTimelineBlock([
    { date: '2013', title: 'React Released', description: 'Facebook open sources React' },
    { date: '2019', title: 'Hooks Introduced', description: 'React 16.8 adds hooks' },
    { date: '2024', title: 'React 19', description: 'Server components and actions' },
  ]),
  tool_list: createToolListBlock([
    { name: 'Screwdriver', quantity: '1', notes: 'Phillips head' },
    { name: 'Wood screws', quantity: '20', notes: '2-inch' },
    { name: 'Sandpaper', quantity: '3 sheets', notes: '120 grit' },
  ]),

  // Cooking blocks
  ingredient: createIngredientBlock(
    [
      { name: 'Spaghetti', amount: '400', unit: 'g' },
      { name: 'Guanciale', amount: '200', unit: 'g', notes: 'or pancetta' },
      { name: 'Egg yolks', amount: '6' },
      { name: 'Pecorino Romano', amount: '100', unit: 'g', notes: 'freshly grated' },
    ],
    4
  ),
  step: createStepBlock([
    { number: 1, instruction: 'Bring a large pot of salted water to boil', duration: 300 },
    { number: 2, instruction: 'Cut guanciale into small cubes', tips: 'Keep pieces uniform for even cooking' },
    { number: 3, instruction: 'Cook pasta until al dente', duration: 480 },
  ]),
  nutrition: createNutritionBlock(
    [
      { nutrient: 'Calories', amount: '450', unit: 'kcal' },
      { nutrient: 'Protein', amount: '18', unit: 'g', dailyValue: '36%' },
      { nutrient: 'Fat', amount: '22', unit: 'g', dailyValue: '28%' },
      { nutrient: 'Carbs', amount: '48', unit: 'g', dailyValue: '16%' },
    ],
    '1 serving'
  ),

  // Coding blocks
  code: createCodeBlock(
    `function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);

  return { count, increment, decrement };
}`,
    'typescript',
    'useCounter.ts',
    [2, 4, 5]
  ),
  terminal: createTerminalBlock(
    'npm install @tanstack/react-query',
    'added 45 packages in 2.3s'
  ),
  file_tree: createFileTreeBlock([
    {
      name: 'src',
      type: 'folder',
      expanded: true,
      children: [
        {
          name: 'components',
          type: 'folder',
          children: [
            { name: 'Button.tsx', type: 'file' },
            { name: 'Input.tsx', type: 'file' },
          ],
        },
        { name: 'App.tsx', type: 'file' },
        { name: 'index.ts', type: 'file' },
      ],
    },
  ]),

  // Travel blocks
  location: createLocationBlock(
    'Fushimi Inari Shrine',
    '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto',
    'Famous for its thousands of vermillion torii gates',
    { lat: 34.9671, lng: 135.7727 }
  ),
  itinerary: createItineraryBlock([
    {
      day: 1,
      title: 'Arrival in Tokyo',
      activities: [
        { time: '14:00', activity: 'Check in at hotel', location: 'Shinjuku' },
        { time: '18:00', activity: 'Dinner at local izakaya', duration: '2 hours' },
      ],
    },
    {
      day: 2,
      title: 'Exploring Tokyo',
      activities: [
        { time: '09:00', activity: 'Visit Senso-ji Temple', location: 'Asakusa' },
        { time: '13:00', activity: 'Lunch in Akihabara', notes: 'Try the ramen!' },
      ],
    },
  ]),
  cost: createCostBlock(
    [
      { category: 'Flights', amount: 800, notes: 'Round trip' },
      { category: 'Accommodation', amount: 1200, notes: '7 nights' },
      { category: 'Food', amount: 400 },
      { category: 'Transport', amount: 200, notes: 'JR Pass' },
    ],
    2600,
    'USD'
  ),

  // Review blocks
  pro_con: createProConBlock(
    ['Excellent camera system', 'Great battery life', 'Premium build quality'],
    ['Expensive', 'Heavy', 'No headphone jack']
  ),
  rating: createRatingBlock(8.5, 10, 'Overall Score', [
    { category: 'Design', score: 9, maxScore: 10 },
    { category: 'Performance', score: 8, maxScore: 10 },
    { category: 'Value', score: 7, maxScore: 10 },
  ]),
  verdict: createVerdictBlock(
    'recommended',
    'An excellent flagship phone that delivers on all fronts, though the price may be prohibitive for some.',
    ['Photography enthusiasts', 'Power users', 'iOS ecosystem fans'],
    ['Budget-conscious buyers', 'Those who need expandable storage']
  ),

  // Fitness blocks
  exercise: createExerciseBlock([
    { name: 'Push-ups', sets: 3, reps: '15', rest: '60s', difficulty: 'beginner' },
    { name: 'Squats', sets: 3, reps: '20', rest: '60s', difficulty: 'beginner' },
    { name: 'Plank', duration: '30s', sets: 3, rest: '30s', difficulty: 'intermediate' },
  ]),
  workout_timer: createWorkoutTimerBlock(
    [
      { name: 'Warm Up', duration: 300, type: 'warmup' },
      { name: 'High Knees', duration: 45, type: 'work' },
      { name: 'Rest', duration: 15, type: 'rest' },
      { name: 'Burpees', duration: 45, type: 'work' },
      { name: 'Cool Down', duration: 180, type: 'cooldown' },
    ],
    3
  ),

  // Education blocks
  quiz: createQuizBlock([
    {
      question: 'What is the capital of Japan?',
      options: ['Osaka', 'Tokyo', 'Kyoto', 'Nagoya'],
      correctIndex: 1,
      explanation: 'Tokyo has been the capital since 1868.',
    },
    {
      question: 'Which hook is used for side effects in React?',
      options: ['useState', 'useEffect', 'useContext', 'useReducer'],
      correctIndex: 1,
      explanation: 'useEffect is designed for handling side effects like data fetching.',
    },
  ]),
  formula: createFormulaBlock(
    'E = mc^2',
    "Einstein's mass-energy equivalence formula",
    false
  ),

  // Podcast blocks
  guest: createGuestBlock([
    {
      name: 'Naval Ravikant',
      title: 'Entrepreneur & Investor',
      bio: 'Co-founder of AngelList, philosopher, and podcaster.',
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com/naval' },
      ],
    },
  ]),

  // Quality blocks
  problem_solution: createProblemSolutionBlock(
    'React re-renders the entire component tree when parent state changes, causing unnecessary renders in child components.',
    'Use React.memo() for pure presentational components and useMemo/useCallback to stabilize references passed as props.',
    'This is especially impactful in large lists where each item re-renders on every keystroke.'
  ),
  visual: createVisualBlock(
    'Architecture diagram showing the data flow from API gateway through microservices to the database layer.',
    'diagram',
    125,
    'System Architecture Overview'
  ),

  // Generic blocks
  table: createTableBlock(
    [
      { key: 'feature', label: 'Feature' },
      { key: 'basic', label: 'Basic', align: 'center' },
      { key: 'pro', label: 'Pro', align: 'center' },
      { key: 'enterprise', label: 'Enterprise', align: 'center' },
    ],
    [
      { feature: 'Storage', basic: '5 GB', pro: '100 GB', enterprise: 'Unlimited' },
      { feature: 'Users', basic: 1, pro: 10, enterprise: 'Unlimited' },
      { feature: 'API Access', basic: 'No', pro: 'Yes', enterprise: 'Yes' },
      { feature: 'Support', basic: 'Email', pro: 'Priority', enterprise: '24/7 Dedicated' },
      { feature: 'Price/mo', basic: '$9', pro: '$29', enterprise: '$99' },
    ],
    'Plan Comparison',
    [2, 4]
  ),
};

// Derived from sampleBlocks to stay in sync automatically
export const BLOCK_TYPE_COUNT = Object.keys(sampleBlocks).length;
