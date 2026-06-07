/**
 * Mock data for interactive component showcases — Dev Only
 *
 * Provides sample data for the post-overhaul 16-component interactive layer:
 * - Retained: MomentTrack, FlashDeck, Comparison (+ verdict), SpotExplorer,
 *   Checklist, InfoGrid
 * - New (video-to-action overhaul): VisualEvidence, VideoFilmstrip,
 *   ConceptCanvas, StepFlowCanvas, ConnectCanvas, CodePlayground,
 *   QuizArena, PackingMission, WorkoutRoom, LyricsKaraoke
 *   (the radar-row mock now feeds the unified ComparisonInteractive radar view)
 *
 * The retired-component mocks (Verdict, Gallery, LyricsPlayer, CodeExplorer,
 * Exercise, Scenario) are intentionally kept for backward compatibility with
 * any remaining consumers (tests, fallbacks) but are no longer wired into the
 * design-system showcase.
 */

import type { ConceptItem } from '@vie/types';

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
  // Matches the post-redesign shape: no title/subtitle/summary (the page-level
  // VideoHero owns those at runtime), inline meta strip, numbered takeaways,
  // cross-tab nav grid, collapsible highlights + tips.
  return {
    duration: '45 min',
    level: 'Advanced',
    itemCount: 8,
    videoId: 'demo-overview',
    keyTakeaways: [
      'React 19 ships a new compiler that auto-memoizes — most useMemo calls become obsolete',
      'Profile before optimizing: the slowest part of your app is rarely where you think it is',
      'Server components reduce client bundle by moving data fetching out of the browser',
      'Suspense for data fetching unlocks streaming HTML and progressive hydration',
      'Concurrent rendering keeps the UI responsive under load — never block the main thread',
      'Treat the React DevTools Profiler flamegraph as ground truth',
    ],
    crossTabLinks: [
      { targetTab: 'concepts', label: 'Concepts', emoji: '🧠', count: 9 },
      { targetTab: 'code', label: 'Code', emoji: '📝', count: 12 },
      { targetTab: 'quizzes', label: 'Quizzes', emoji: '🧪', count: 6 },
      { targetTab: 'timeline', label: 'Timeline', emoji: '⏱️' },
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
  };
}

export function createMockInfoGrid() {
  // Showcases the three card shapes the normalizer produces: bare key/value
  // (reference rows), key/value with `evidence` (term + definition + example),
  // and emoji-prefixed entries. Mixing them in one mock lets us verify that
  // the live design-system page matches what real videos ship.
  return {
    items: [
      { key: 'Framework', value: 'React 19' },
      { key: 'Bundler', value: 'Vite 6' },
      {
        key: 'Attention',
        value: 'Weighted sum of token embeddings, where weights come from query·key dot products.',
        evidence: "Demonstrated at 4:32 with the 'cat sat on the mat' example.",
        emoji: '🧠',
      },
      {
        key: 'Tokenization',
        value: 'Splitting text into discrete units before embedding.',
        evidence: "'Hello world' → ['Hello', 'world']",
      },
      { key: 'State', value: 'Zustand', emoji: '🗂️' },
      { key: 'Testing', value: 'Vitest + Playwright' },
      { key: 'Styling', value: 'Tailwind v4', emoji: '🎨' },
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

// ── Video-to-Action Overhaul Mock Data (2026-05-28) ──

const PLACEHOLDER_FRAME = (label: string) =>
  `https://placehold.co/640x360/1a1a2e/ffffff?text=${encodeURIComponent(label)}`;

/**
 * Sample frame metadata for the VisualEvidence primitive demo — one frame
 * carries the full vision payload (caption + OCR + scene type + rationale)
 * so the compact and figure variants both render meaningfully.
 */
export function createMockVisualEvidence() {
  return {
    thumbnailUrl: PLACEHOLDER_FRAME('attention · 4:32'),
    caption: 'Animated diagram of attention weights between query and key tokens.',
    ocr: 'softmax(Q·Kᵀ / √d_k) · V',
    sceneType: 'diagram',
    evidence: 'The exact softmax inputs the presenter walks through at 4:32.',
    timestamp: 272,
  };
}

/**
 * Eight frames spanning a fictional 30-minute video — mixes scene types
 * (slide, demo, code, diagram, talking_head) so the filmstrip renders the
 * full caption + OCR vocabulary.
 */
export function createMockFilmstripFrames() {
  return [
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Intro · 0:00'),
      timestamp: 0,
      caption: 'Title card with the presenter introducing the topic.',
      sceneType: 'slide',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Architecture · 1:45'),
      timestamp: 105,
      caption: 'High-level architecture diagram showing the data flow.',
      ocr: 'Client → API → Worker → DB',
      sceneType: 'diagram',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Code · 4:20'),
      timestamp: 260,
      caption: 'Live editor showing the request handler implementation.',
      ocr: "fastify.post('/videos', handler)",
      sceneType: 'code',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Diagram · 7:30'),
      timestamp: 450,
      caption: 'Sequence diagram of the queue retry policy.',
      sceneType: 'diagram',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Demo · 11:15'),
      timestamp: 675,
      caption: 'Demo: triggering the pipeline and watching live SSE events.',
      sceneType: 'demo',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Slide · 15:40'),
      timestamp: 940,
      caption: 'Slide listing the three caching layers.',
      ocr: '1. Redis · 2. Mongo · 3. CDN',
      sceneType: 'slide',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Diagram · 21:00'),
      timestamp: 1260,
      caption: 'Per-stage cost diagram with model fan-out.',
      ocr: 'Plan $0.01 · Extract $0.04 · Synth $0.01',
      sceneType: 'diagram',
    },
    {
      thumbnailUrl: PLACEHOLDER_FRAME('Outro · 27:50'),
      timestamp: 1670,
      caption: 'Closing summary with the three key takeaways.',
      sceneType: 'slide',
    },
  ];
}

/**
 * Concepts forming a small relational graph for ConceptCanvas. Each lists
 * typed `connections` (`{to, type}`) so the canvas can encode relationship type
 * by line-style + arrowhead, and a `group` so the graph splits into tiered
 * lanes / Groups list-cards. One concept carries frame evidence to exercise the
 * inspector's `VisualEvidence`. Includes an orphan to verify layout robustness.
 */
export function createMockConcepts(): ConceptItem[] {
  return [
    {
      name: 'Attention',
      emoji: '🧠',
      definition: 'A weighted aggregation where each output position attends to every input position.',
      example: "In 'the cat sat on the mat', 'cat' attends most strongly to 'sat'.",
      group: 'Core architecture',
      timestamp: 312,
      thumbnailUrl: PLACEHOLDER_FRAME('Attention heatmap'),
      frameCaption: 'Attention weight heatmap across token positions.',
      frameSceneType: 'diagram',
      connections: [
        { to: 'Transformer', type: 'partOf' },
        { to: 'Softmax', type: 'requires' },
      ],
    },
    {
      name: 'Transformer',
      emoji: '🤖',
      definition: 'A sequence model built from stacked attention and feed-forward layers — no recurrence.',
      example: 'GPT, BERT, and Llama all share the transformer backbone.',
      group: 'Core architecture',
      connections: [
        { to: 'Attention', type: 'requires' },
        { to: 'Embedding', type: 'requires' },
      ],
    },
    {
      name: 'Embedding',
      emoji: '📐',
      definition: 'A dense vector representation of a discrete token, learned during training.',
      example: "'King' - 'Man' + 'Woman' ≈ 'Queen' in word2vec space.",
      group: 'Inputs',
      connections: [{ to: 'Tokenization', type: 'requires' }],
    },
    {
      name: 'Tokenization',
      emoji: '✂️',
      definition: 'Splitting raw text into the discrete units a model consumes.',
      example: "'Hello world!' → ['Hello', ' world', '!']",
      group: 'Inputs',
      connections: [{ to: 'Embedding', type: 'causes' }],
    },
    {
      name: 'Softmax',
      emoji: '📊',
      definition: 'A normalization that converts an arbitrary vector into a probability distribution.',
      group: 'Training',
      connections: [{ to: 'Attention', type: 'partOf' }],
    },
    {
      name: 'Greedy decoding',
      emoji: '🎯',
      definition: 'Picking the highest-probability token at each step — fast but myopic.',
      group: 'Training',
      connections: [{ to: 'Softmax', type: 'contrasts' }],
    },
    {
      name: 'Backprop',
      emoji: '🔁',
      definition: 'The chain-rule algorithm that propagates gradients backwards through the network.',
      group: 'Training',
      connections: [],
    },
  ];
}

/** Ordered group lanes for the ConceptCanvas demo (matches createMockConcepts). */
export function createMockConceptGroups(): string[] {
  return ['Core architecture', 'Inputs', 'Training'];
}

/**
 * Six steps suitable for StepFlowCanvas — mixes steps with thumbnails,
 * durations, tips, and safety notes so all node features render. Numbered
 * 1–6 with a clear linear progression for the animated-edge demo.
 */
export function createMockStepFlowSteps() {
  return [
    {
      number: 1,
      title: 'Scaffold the project',
      instruction: 'Run `npm create vite@latest` and pick React + TypeScript.',
      duration: '2 min',
      thumbnailUrl: PLACEHOLDER_FRAME('Step 1 · scaffold'),
    },
    {
      number: 2,
      title: 'Install dependencies',
      instruction: 'Add Tailwind, shadcn/ui, and @tanstack/react-query.',
      duration: '3 min',
      tips: 'Pin major versions in package.json to keep upgrades predictable.',
    },
    {
      number: 3,
      title: 'Configure Tailwind v4',
      instruction: 'Replace tailwind.config.js with @theme inline {} in index.css.',
      duration: '5 min',
      thumbnailUrl: PLACEHOLDER_FRAME('Step 3 · tailwind'),
    },
    {
      number: 4,
      title: 'Wire up the router',
      instruction: 'Define routes in App.tsx and lazy-load each page.',
      duration: '8 min',
    },
    {
      number: 5,
      title: 'Hook up auth',
      instruction: 'Add the JWT interceptor to the fetch client and gate protected routes.',
      duration: '12 min',
      safetyNote: 'Never store tokens in localStorage in production — use httpOnly cookies.',
      thumbnailUrl: PLACEHOLDER_FRAME('Step 5 · auth'),
    },
    {
      number: 6,
      title: 'Deploy',
      instruction: 'Push to main and let the CI pipeline ship to Vercel.',
      duration: '4 min',
    },
  ];
}

/**
 * Five comparison rows with four+ distinct axes — suitable for a radar
 * with three or more spokes. Each row has parseable numeric values on
 * both sides so the unified ComparisonInteractive radar hero's numeric-scoring
 * branch fires.
 */
export function createMockComparisonRadarRows() {
  return [
    { feature: 'Camera (MP)', thisProduct: '48', competitor: '50', competitorName: 'Galaxy S24', winner: 'right' as const },
    { feature: 'Battery (mAh)', thisProduct: '4422', competitor: '4000', competitorName: 'Galaxy S24', winner: 'left' as const },
    { feature: 'Display (Hz)', thisProduct: '120', competitor: '120', competitorName: 'Galaxy S24', winner: 'tie' as const },
    { feature: 'Weight (g)', thisProduct: '187', competitor: '227', competitorName: 'Galaxy S24', winner: 'left' as const },
    { feature: 'Price ($)', thisProduct: '999', competitor: '799', competitorName: 'Galaxy S24', winner: 'right' as const },
  ];
}

/**
 * Five matching pairs for the ConnectCanvas graded quiz. Each prompt connects
 * to exactly one answer; the right column is shuffled by the component.
 */
export function createMockConnectCanvasPairs() {
  return [
    { prompt: 'Embedding', match: 'Vector space' },
    { prompt: 'Attention', match: 'Token weighting' },
    { prompt: 'Residual stream', match: 'Skip connection' },
    { prompt: 'Softmax', match: 'Probability distribution' },
  ];
}

/**
 * Three TechSnippet entries (JS, Python, TS) with realistic code — covers
 * the syntax highlighter's three primary keyword sets and exercises the
 * Run-iframe path (the JS + TS snippets are flagged runnable).
 */
export function createMockCodePlaygroundSnippets() {
  return [
    {
      filename: 'debounce.ts',
      language: 'typescript',
      code: `export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const log = debounce((msg: string) => console.log(msg), 250);
log('hello');
log('world');`,
      explanation: 'A type-safe debounce — the generic captures the wrapped function\'s arg tuple so the returned function preserves its signature.',
      timestamp: 320,
    },
    {
      filename: 'fizzbuzz.py',
      language: 'python',
      code: `def fizzbuzz(n: int) -> list[str]:
    """Return the FizzBuzz sequence up to n (inclusive)."""
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(str(i))
    return out


print(fizzbuzz(15))`,
      explanation: 'The canonical FizzBuzz, written with type hints and a single pass through the range.',
    },
    {
      filename: 'memo.js',
      language: 'javascript',
      code: `function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const slowSquare = (n) => {
  console.log('computing', n);
  return n * n;
};
const fastSquare = memoize(slowSquare);
console.log(fastSquare(7));
console.log(fastSquare(7));`,
      explanation: 'Memoization with a JSON-serialized cache key — works for any arity but assumes JSON-safe args.',
      timestamp: 540,
    },
  ];
}

/**
 * Four quiz questions mixing standard knowledge checks with one
 * frame-aware scenario question carrying `context` + `kind:'scenario'`
 * + thumbnail metadata so the evidence-frame branch renders.
 */
export function createMockQuizArenaQuestions() {
  return [
    {
      question: 'Which complexity class describes binary search on a sorted array?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correctIndex: 1,
      explanation: 'Each iteration halves the search space, so the worst case is logarithmic.',
    },
    {
      question: 'What does the `await` keyword do?',
      options: [
        'Pauses the entire thread',
        'Blocks the JavaScript engine until the promise resolves',
        'Suspends the surrounding async function until the awaited promise settles',
        'Polls the promise every 16 ms',
      ],
      correctIndex: 2,
      explanation: 'Only the surrounding async function suspends — the event loop continues running.',
    },
    {
      question: 'You see this exact stack trace mid-presentation. What is the root cause?',
      kind: 'scenario' as const,
      context: 'The presenter has just demonstrated a TypeError thrown by a destructure on an undefined response.',
      options: [
        'The API returned a 500 — back-end bug',
        'The fetch call resolved before the response body was parsed',
        'The destructure ran before the optional-chain guard, so an undefined response crashed it',
        'The component re-rendered before state was initialized',
      ],
      correctIndex: 2,
      explanation: 'The classic destructure-before-guard pattern — fix is to either guard with ?? or chain with ?.',
      thumbnailUrl: PLACEHOLDER_FRAME('Stack · 11:30'),
      frameCaption: 'Console showing the TypeError at the destructure line.',
      timestamp: 690,
    },
    {
      question: 'In React, when does useEffect with an empty dependency array run?',
      options: ['On every render', 'Once after the first commit', 'Never', 'Once before the first render'],
      correctIndex: 1,
      explanation: 'An empty deps array means the effect runs once after mount and cleans up at unmount.',
    },
  ];
}

/**
 * Twelve packing items spanning clothing, electronics, documents, toiletries,
 * and miscellaneous — with weights, essentials, and emoji icons so all
 * suitcase-mission visual states are exercised.
 */
export function createMockPackingItems() {
  return [
    { item: 'Passport', category: 'Documents', essential: true, weight: 0.1, emoji: '🛂' },
    { item: 'Travel insurance card', category: 'Documents', essential: true, weight: 0.05, emoji: '🩺' },
    { item: 'Phone charger', category: 'Electronics', essential: true, weight: 0.2, emoji: '🔌' },
    { item: 'Universal adapter', category: 'Electronics', essential: true, weight: 0.15, emoji: '⚡' },
    { item: 'Laptop', category: 'Electronics', weight: 1.6, emoji: '💻' },
    { item: 'Lightweight rain jacket', category: 'Clothing', essential: true, weight: 0.4, emoji: '🧥' },
    { item: 'Comfortable walking shoes', category: 'Clothing', essential: true, weight: 0.9, emoji: '👟' },
    { item: 'Two T-shirts', category: 'Clothing', weight: 0.5, emoji: '👕' },
    { item: 'Toothbrush & travel paste', category: 'Toiletries', weight: 0.1, emoji: '🪥' },
    { item: 'Sunscreen SPF 50', category: 'Toiletries', weight: 0.15, emoji: '🧴' },
    { item: 'Reusable water bottle', category: 'Misc', weight: 0.3, emoji: '🚰' },
    { item: 'Paperback book', category: 'Misc', weight: 0.25, emoji: '📖' },
  ];
}

/**
 * Five workout exercises covering reps, duration, sets, supersets, and
 * form-cue frames — used by WorkoutRoom for the auto-advance and form-cue
 * panel demos.
 */
export function createMockWorkoutExercises() {
  return [
    {
      name: 'Push-ups',
      emoji: '💪',
      sets: 3,
      reps: '12-15',
      rest: '60s',
      difficulty: 'beginner' as const,
      formCues: ['Keep core engaged', 'Elbows track at 45° — not flared'],
      modifications: [{ label: 'Easier', description: 'Knee push-ups' }],
      thumbnailUrl: PLACEHOLDER_FRAME('Push-up form'),
      frameCaption: 'Side-angle showing neutral spine and 45° elbow position.',
    },
    {
      name: 'Goblet Squats',
      emoji: '🦵',
      sets: 4,
      reps: '10',
      rest: '60s',
      difficulty: 'intermediate' as const,
      formCues: ['Heels stay down', 'Knees track over toes', 'Chest stays up'],
      modifications: [{ label: 'Easier', description: 'Bodyweight squats' }],
    },
    {
      name: 'Plank',
      emoji: '🧘',
      sets: 3,
      duration: '45s',
      rest: '30s',
      difficulty: 'beginner' as const,
      formCues: ['Straight line from head to heels', 'Don\'t let hips sag'],
      modifications: [{ label: 'Easier', description: 'Forearm plank on knees' }],
      thumbnailUrl: PLACEHOLDER_FRAME('Plank form'),
    },
    {
      name: 'Renegade Rows',
      emoji: '🏋️',
      sets: 3,
      reps: '8 per side',
      rest: '60s',
      difficulty: 'advanced' as const,
      formCues: ['Hips stay square to the floor', 'Pull elbow back, not out'],
      modifications: [{ label: 'Easier', description: 'Drop to a forearm plank between rows' }],
      supersetWith: 'Push-ups',
    },
    {
      name: 'Burpees',
      emoji: '🔥',
      sets: 3,
      reps: '8',
      rest: '90s',
      difficulty: 'advanced' as const,
      formCues: ['Chest fully touches the floor', 'Full extension at the top'],
      modifications: [{ label: 'Easier', description: 'Step-back burpees (no jump)' }],
    },
  ];
}

/**
 * Two sections (verse + chorus + verse) with eight+ timestamped lines —
 * the first verse carries `words[]` for the word-sync karaoke demo, the
 * other sections use whole-line timestamps only so both code paths render.
 */
export function createMockLyricsKaraokeSections() {
  return [
    {
      name: 'Verse 1',
      timestamp: 0,
      lines: [
        {
          text: 'Walking through the neon streets',
          timestamp: 0,
          words: [
            { text: 'Walking', startTime: 0, endTime: 0.6 },
            { text: 'through', startTime: 0.6, endTime: 1.0 },
            { text: 'the', startTime: 1.0, endTime: 1.2 },
            { text: 'neon', startTime: 1.2, endTime: 1.7 },
            { text: 'streets', startTime: 1.7, endTime: 2.4 },
          ],
        },
        {
          text: 'Where the city never sleeps',
          timestamp: 4,
          words: [
            { text: 'Where', startTime: 4.0, endTime: 4.4 },
            { text: 'the', startTime: 4.4, endTime: 4.6 },
            { text: 'city', startTime: 4.6, endTime: 5.1 },
            { text: 'never', startTime: 5.1, endTime: 5.6 },
            { text: 'sleeps', startTime: 5.6, endTime: 6.2 },
          ],
        },
        { text: 'Every light a story told', timestamp: 8 },
        { text: 'In this place of digital gold', timestamp: 12 },
      ],
    },
    {
      name: 'Chorus',
      timestamp: 18,
      lines: [
        { text: 'We are the signals in the noise', timestamp: 18 },
        { text: 'Finding meaning, finding voice', timestamp: 22 },
        { text: 'In a world of endless choice', timestamp: 26 },
        { text: 'We rise above the static joys', timestamp: 30 },
      ],
    },
  ];
}
