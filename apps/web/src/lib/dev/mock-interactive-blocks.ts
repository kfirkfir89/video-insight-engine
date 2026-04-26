/**
 * Mock data for interactive component showcases — Dev Only
 *
 * Provides sample data for:
 * - Core blocks: FlashCard, ScenarioCard, SpotCard, ScoreRing
 * - Interactive output components: ChecklistInteractive, QuizInteractive,
 *   FlashDeckInteractive, ScenarioInteractive, SpotExplorer,
 *   StepByStepInteractive, ExerciseInteractive, MomentTrack,
 *   CodeExplorer, ComparisonInteractive
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('mock-interactive-blocks should not be imported in production');
}

// ── Core Block Mock Data ──

export function createMockFlashCards() {
  return [
    {
      front: 'What is the time complexity of binary search?',
      back: 'O(log n) — the search space is halved each step.',
      emoji: '🔍',
      category: 'Algorithms',
    },
    {
      front: 'What does SOLID stand for in software design?',
      back: 'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.',
      emoji: '🏗️',
      category: 'Design Principles',
    },
    {
      front: 'What is a closure in JavaScript?',
      back: 'A function that retains access to its outer scope variables even after the outer function has returned.',
      emoji: '📦',
      category: 'JavaScript',
    },
  ];
}

export function createMockScenarios() {
  return [
    {
      question: 'You need to store unique items and check membership frequently. Which data structure?',
      emoji: '🤔',
      options: [
        { text: 'Array', correct: false, explanation: 'Arrays have O(n) lookup. Not ideal for frequent membership checks.' },
        { text: 'Set', correct: true, explanation: 'Sets provide O(1) average lookup and guarantee uniqueness.' },
        { text: 'Linked List', correct: false, explanation: 'Linked lists have O(n) lookup and no uniqueness guarantee.' },
        { text: 'Stack', correct: false, explanation: 'Stacks are LIFO structures, not optimized for membership checks.' },
      ],
    },
    {
      question: 'Your API returns nested data that changes frequently. How do you manage it in React?',
      emoji: '⚛️',
      options: [
        { text: 'Store everything in useState', correct: false, explanation: 'Local state works but doesn\'t handle caching, revalidation, or deduplication.' },
        { text: 'Use React Query / TanStack Query', correct: true, explanation: 'Server state libraries handle caching, background revalidation, and deduplication automatically.' },
        { text: 'Put it all in Redux', correct: false, explanation: 'Redux adds boilerplate for server state. Better tools exist for this pattern.' },
      ],
    },
  ];
}

export function createMockSpots() {
  return [
    {
      icon: '🍜',
      name: 'Ichiran Ramen',
      subtitle: 'Famous solo-booth ramen experience',
      cost: '1,200',
      currency: '¥',
      tip: 'Go during off-peak hours (2-4 PM) to avoid the queue. Customize your noodle firmness and spice level at the counter.',
      mapsQuery: 'Ichiran Ramen Shibuya Tokyo',
      rating: 4.5,
    },
    {
      icon: '🏛️',
      name: 'Fushimi Inari Shrine',
      subtitle: 'Thousands of vermillion torii gates',
      tip: 'Start at sunrise for empty trails and the best photos. The full hike takes about 2 hours.',
      mapsQuery: 'Fushimi Inari Taisha Kyoto',
      rating: 4.8,
    },
    {
      icon: '🌸',
      name: 'Ueno Park',
      subtitle: 'Cherry blossom viewing spot',
      tip: 'Best during late March to early April. Bring a picnic blanket for hanami.',
      mapsQuery: 'Ueno Park Tokyo',
    },
  ];
}

export const scoreRingConfigs = [
  { score: 85, maxScore: 100, label: 'Percentage', size: 'sm' as const },
  { score: 7.5, maxScore: 10, label: 'Rating', size: 'md' as const },
  { score: 42, maxScore: 50, label: 'Fraction', size: 'lg' as const },
] as const;

// ── Interactive Output Component Mock Data ──

export function createMockChecklist() {
  return {
    items: [
      { label: '2 cups all-purpose flour', note: 'sifted' },
      { label: '1 cup whole milk', emoji: '🥛' },
      { label: '3 large eggs', note: 'room temperature' },
      { label: '½ cup unsalted butter', note: 'melted', emoji: '🧈' },
      { label: '1 tsp vanilla extract' },
      { label: 'Pinch of salt' },
    ],
    tabLabel: 'Ingredients',
  };
}

export function createMockQuizQuestions() {
  return [
    {
      question: 'What is the capital of Japan?',
      options: ['Osaka', 'Tokyo', 'Kyoto', 'Nagoya'],
      correctIndex: 1,
      explanation: 'Tokyo has been the capital since 1868 when the Emperor moved from Kyoto.',
    },
    {
      question: 'Which React hook is used for side effects?',
      options: ['useState', 'useEffect', 'useContext', 'useMemo'],
      correctIndex: 1,
      explanation: 'useEffect handles side effects like data fetching, subscriptions, and DOM mutations.',
    },
    {
      question: 'What does CSS stand for?',
      options: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style System', 'Colorful Style Sheets'],
      correctIndex: 1,
      explanation: 'CSS = Cascading Style Sheets, introduced in 1996.',
    },
  ];
}

export function createMockSteps() {
  return [
    {
      number: 1,
      title: 'Preheat the Oven',
      instruction: 'Set your oven to 375°F (190°C). Position the rack in the center.',
      duration: '5 min',
      tips: 'Use an oven thermometer for accuracy — most ovens run 25°F off.',
      thumbnailUrl: 'https://placehold.co/400x200/1a1a2e/ffffff?text=Step+1',
    },
    {
      number: 2,
      title: 'Mix Dry Ingredients',
      instruction: 'Whisk flour, baking powder, and salt together in a large bowl.',
      tips: 'Sift the flour for a lighter texture.',
      thumbnailUrl: 'https://placehold.co/400x200/1a1a2e/ffffff?text=Step+2',
    },
    {
      number: 3,
      title: 'Combine Wet Ingredients',
      instruction: 'In a separate bowl, beat eggs, add milk, melted butter, and vanilla.',
      duration: '3 min',
    },
    {
      number: 4,
      title: 'Fold Together & Bake',
      instruction: 'Gently fold wet into dry until just combined. Pour into greased pan and bake for 25 minutes.',
      duration: '25 min',
      safetyNote: 'Use oven mitts — the pan will be very hot.',
    },
  ];
}

export function createMockExercises() {
  return {
    exercises: [
      { name: 'Push-ups', emoji: '💪', sets: 3, reps: '15', rest: '60s', difficulty: 'beginner' as const, formCues: ['Keep core tight', 'Elbows at 45°'], modifications: [{ label: 'Easier', description: 'Knee push-ups' }] },
      { name: 'Squats', emoji: '🦵', sets: 4, reps: '20', rest: '60s', difficulty: 'beginner' as const, formCues: ['Knees over toes', 'Chest up'], modifications: [{ label: 'Harder', description: 'Jump squats' }] },
      { name: 'Plank', emoji: '🧘', sets: 3, duration: '45s', rest: '30s', difficulty: 'intermediate' as const, formCues: ['Straight line from head to heels'], modifications: [{ label: 'Easier', description: 'Forearm plank on knees' }] },
      { name: 'Burpees', emoji: '🔥', sets: 3, reps: '10', rest: '90s', difficulty: 'advanced' as const, formCues: ['Full extension at top', 'Chest to floor'], modifications: [{ label: 'Easier', description: 'No push-up burpees' }] },
    ],
    warmup: ['5 minutes light jogging', 'Arm circles (30 seconds each direction)', 'Hip rotations'],
    cooldown: ['Hamstring stretch (30s each leg)', 'Quad stretch (30s each leg)', 'Deep breathing (1 minute)'],
  };
}

export function createMockTimeline() {
  return [
    { time: '0:00', seconds: 0, label: 'Introduction', description: 'Overview of the topic and what we\'ll cover today.', emoji: '👋', thumbnailUrl: 'https://placehold.co/160x100/1a1a2e/ffffff?text=0:00' },
    { time: '2:15', seconds: 135, label: 'Core Concepts', description: 'Deep dive into the fundamental principles.', emoji: '📚', thumbnailUrl: 'https://placehold.co/160x100/1a1a2e/ffffff?text=2:15' },
    { time: '8:30', seconds: 510, label: 'Live Demo', description: 'Building a real-world example from scratch.', emoji: '💻', mood: 'energetic', thumbnailUrl: 'https://placehold.co/160x100/1a1a2e/ffffff?text=8:30' },
    { time: '15:45', seconds: 945, label: 'Common Pitfalls', description: 'Mistakes to avoid and how to debug them.', emoji: '⚠️' },
    { time: '22:00', seconds: 1320, label: 'Best Practices', description: 'Production-ready patterns and performance tips.', emoji: '✨' },
    { time: '28:10', seconds: 1690, label: 'Wrap Up', description: 'Summary and resources for further learning.', emoji: '🎯' },
  ];
}

export function createMockCodeSnippets() {
  return [
    {
      code: `import { useState, useCallback } from 'react';

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);

  return { count, increment, decrement, reset };
}`,
      filename: 'useCounter.ts',
      language: 'typescript',
      explanation: 'A custom hook that encapsulates counter logic with memoized callbacks to prevent unnecessary re-renders.',
    },
    {
      code: `interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ErrorBoundary({ children, fallback }: Props) {
  // Error boundary implementation...
  return <>{children}</>;
}`,
      filename: 'ErrorBoundary.tsx',
      language: 'tsx',
      explanation: 'Type-safe error boundary component with optional fallback UI.',
    },
    {
      code: `# Install dependencies
npm install @tanstack/react-query

# Generate types from schema
npx prisma generate`,
      filename: 'setup.sh',
      language: 'bash',
      explanation: 'Project setup commands — install React Query for server state and generate Prisma types.',
    },
  ];
}

export function createMockComparisons() {
  return {
    comparisons: [
      { feature: 'Camera', thisProduct: '48MP triple lens', competitor: '50MP dual lens', competitorName: 'Galaxy S24' },
      { feature: 'Battery', thisProduct: '4,422 mAh', competitor: '4,000 mAh', competitorName: 'Galaxy S24' },
      { feature: 'Display', thisProduct: '6.7" OLED 120Hz', competitor: '6.2" AMOLED 120Hz', competitorName: 'Galaxy S24' },
      { feature: 'Price', thisProduct: '$999', competitor: '$799', competitorName: 'Galaxy S24' },
    ],
    pros: ['Excellent camera system', 'Premium build quality', 'Fast software updates', 'Great ecosystem integration'],
    cons: ['Expensive', 'No expandable storage', 'Slow charging vs competitors'],
  };
}

export function createMockSpotExplorerWithSections() {
  return {
    spots: [
      { emoji: '⛩️', name: 'Senso-ji Temple', description: 'Tokyo\'s oldest temple', tips: 'Visit early morning for fewer crowds.', mapQuery: 'Senso-ji Tokyo', rating: 4.7, thumbnailUrl: 'https://placehold.co/400x200/1a1a2e/ffffff?text=Senso-ji' },
      { emoji: '🗼', name: 'Tokyo Tower', description: 'Iconic landmark', cost: '1,200', currency: '¥', tips: 'The night view is spectacular.', mapQuery: 'Tokyo Tower', rating: 4.5, thumbnailUrl: 'https://placehold.co/400x200/1a1a2e/ffffff?text=Tokyo+Tower' },
      { emoji: '🦌', name: 'Nara Park', description: 'Friendly deer and ancient temples', tips: 'Buy deer crackers at the entrance.', mapQuery: 'Nara Park', rating: 4.6 },
      { emoji: '🏯', name: 'Osaka Castle', description: 'Historic castle with museum', cost: '600', currency: '¥', tips: 'Cherry blossom season is magical here.', mapQuery: 'Osaka Castle', rating: 4.4 },
    ],
    sections: [
      { label: 'Day 1: Tokyo', spotIndices: [0, 1] },
      { label: 'Day 2: Nara & Osaka', spotIndices: [2, 3] },
    ],
  };
}

// ── New Interactive Output Component Mock Data ──

export function createMockVerdict() {
  return {
    product: 'iPhone 16 Pro Max',
    bottomLine: 'The best iPhone ever made, but the incremental upgrades may not justify upgrading from the 15 Pro.',
    score: 8.5,
    maxScore: 10,
    badge: 'Recommended',
    bestFor: ['Photography enthusiasts', 'Power users', 'iOS ecosystem fans'],
    notFor: ['Budget-conscious buyers', 'Those who need expandable storage'],
    price: '$1,199',
  };
}

export function createMockBudget() {
  return {
    total: 3200,
    currency: '€',
    breakdown: [
      { category: 'Flights', amount: 800, emoji: '✈️', notes: 'Round trip from Berlin' },
      { category: 'Accommodation', amount: 1200, emoji: '🏨', notes: '7 nights, 3-star hotel' },
      { category: 'Food & Dining', amount: 500, emoji: '🍽️' },
      { category: 'Activities', amount: 400, emoji: '🎭', notes: 'Museum passes, tours' },
      { category: 'Transport', amount: 200, emoji: '🚃', notes: 'Local trains & buses' },
      { category: 'Shopping', amount: 100, emoji: '🛍️' },
    ],
    savingTips: [
      'Book flights 6-8 weeks in advance for best prices.',
      'Use a city tourism card for free public transport and museum entry.',
      'Eat lunch at local markets instead of sit-down restaurants.',
    ],
  };
}

export function createMockOverview() {
  return {
    title: 'React Performance Masterclass',
    emoji: '⚡',
    subtitle: 'A comprehensive guide to optimizing React applications for speed and efficiency.',
    stats: [
      { label: 'Duration', value: '45 min', emoji: '⏱️' },
      { label: 'Topics', value: '8', emoji: '📚' },
      { label: 'Level', value: 'Advanced', emoji: '🎯' },
    ],
    highlights: [
      { emoji: '🔥', text: 'Virtual DOM reconciliation deep dive' },
      { emoji: '🧩', text: 'Code splitting with React.lazy and Suspense' },
      { emoji: '📊', text: 'Profiler API for identifying bottlenecks' },
      { emoji: '🪝', text: 'useMemo and useCallback best practices' },
    ],
    tips: [
      'Always measure before optimizing — premature optimization is the root of all evil.',
      'Use React DevTools Profiler to identify actual bottlenecks.',
      'Prefer composition over memoization when possible.',
    ],
    summary: 'This masterclass covers everything from basic rendering optimization to advanced patterns like virtualization and concurrent features. Perfect for developers looking to ship faster React apps.',
  };
}

export function createMockInfoGrid() {
  return {
    items: [
      { key: 'Framework', value: 'React 19' },
      { key: 'Language', value: 'TypeScript 5.4' },
      { key: 'Bundler', value: 'Vite 5' },
      { key: 'Styling', value: 'Tailwind v4' },
      { key: 'State', value: 'Zustand' },
      { key: 'Testing', value: 'Vitest' },
      { key: 'E2E', value: 'Playwright' },
      { key: 'CI/CD', value: 'GitHub Actions' },
    ],
  };
}

export function createMockGallery() {
  return {
    images: [
      { query: 'tokyo skyline sunset', caption: 'Tokyo skyline at golden hour', alt: 'Tokyo skyline' },
      { query: 'fushimi inari shrine gates', caption: 'Thousands of torii gates at Fushimi Inari', alt: 'Fushimi Inari' },
      { query: 'japanese garden zen', caption: 'Zen garden in Kyoto', alt: 'Zen garden' },
      { query: 'shibuya crossing night', caption: 'The famous Shibuya scramble crossing', alt: 'Shibuya crossing' },
      { query: 'mount fuji cherry blossom', caption: 'Mt. Fuji framed by cherry blossoms', alt: 'Mt. Fuji' },
      { query: 'osaka dotonbori neon', caption: 'Neon lights of Dotonbori, Osaka', alt: 'Dotonbori' },
    ],
  };
}

export function createMockClips() {
  return {
    clips: [
      { label: 'Opening Hook', startSeconds: 0, time: '0:00', description: 'The host introduces the topic with a surprising statistic.', mood: 'energetic', tags: ['intro'], thumbnailUrl: 'https://placehold.co/140x90/1a1a2e/ffffff?text=0:00' },
      { label: 'Key Insight', startSeconds: 185, time: '3:05', description: 'The central thesis: why conventional wisdom is wrong.', mood: 'thoughtful', thumbnailUrl: 'https://placehold.co/140x90/1a1a2e/ffffff?text=3:05' },
      { label: 'Live Demo', startSeconds: 420, time: '7:00', description: 'Building the example from scratch in real time.', mood: 'energetic', tags: ['code', 'demo'] },
      { label: 'Plot Twist', startSeconds: 690, time: '11:30', description: 'Unexpected benchmark results that challenge assumptions.', mood: 'surprising', tags: ['data'] },
      { label: 'Wrap Up', startSeconds: 900, time: '15:00', description: 'Summary and call to action.', mood: 'calm' },
    ],
    filters: true,
  };
}

export function createMockLyrics() {
  return {
    sections: [
      {
        name: 'Verse 1',
        timestamp: 0,
        lines: [
          { line: 'Walking through the neon streets', timestamp: 0 },
          { line: 'Where the city never sleeps', timestamp: 4 },
          { line: 'Every light a story told', timestamp: 8 },
          { line: 'In this place of digital gold', timestamp: 12 },
        ],
        analysis: 'The opening verse establishes the urban setting with vivid imagery, contrasting the digital and physical worlds.',
      },
      {
        name: 'Chorus',
        timestamp: 18,
        lines: [
          { line: 'We are the signals in the noise', timestamp: 18 },
          { line: 'Finding meaning, finding voice', timestamp: 22 },
          { line: 'In a world of endless choice', timestamp: 26 },
        ],
      },
      {
        name: 'Verse 2',
        timestamp: 32,
        lines: [
          { line: 'Screens reflecting in the rain', timestamp: 32 },
          { line: 'Every pixel holds some pain', timestamp: 36 },
          { line: 'But between the lines of code', timestamp: 40 },
          { line: 'Something beautiful has grown', timestamp: 44 },
        ],
        analysis: 'The second verse deepens the metaphor, suggesting that technology, despite its coldness, enables genuine human connection.',
      },
    ],
    artist: 'Digital Wanderer',
  };
}
