/**
 * Mock Videos for Dev Pages
 *
 * Complete VideoResponse + VideoSummary for all 10 categories.
 * Uses mock block factories for content.
 *
 * IMPORTANT: Dev-only module - tree-shaken in production.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('mock-videos.ts should not be imported in production');
}

import type {
  VideoResponse,
  VideoSummary,
  VideoContext,
  VideoCategory,
  SummaryChapter,
  DescriptionAnalysis,
  ContentBlock,
} from '@vie/types';

import {
  createParagraphBlock,
  createBulletsBlock,
  createNumberedBlock,
  createCalloutBlock,
  createTimestampBlock,
  createQuoteBlock,
  createStatisticBlock,
  createIngredientBlock,
  createStepBlock,
  createNutritionBlock,
  createCodeBlock,
  createTerminalBlock,
  createFileTreeBlock,
  createLocationBlock,
  createItineraryBlock,
  createCostBlock,
  createProConBlock,
  createRatingBlock,
  createVerdictBlock,
  createExerciseBlock,
  createWorkoutTimerBlock,
  createQuizBlock,
  createFormulaBlock,
  createGuestBlock,
  createToolListBlock,
  createDefinitionBlock,
  createComparisonBlock,
} from './mock-blocks';

// ─────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function createChapter(
  index: number,
  title: string,
  content: ContentBlock[],
  duration: number = 300
): SummaryChapter {
  const startSeconds = index * duration;
  return {
    id: uuid(),
    timestamp: formatTimestamp(startSeconds),
    startSeconds,
    endSeconds: startSeconds + duration,
    title,
    isCreatorChapter: true,
    content,
  };
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createMockDescriptionAnalysis(): DescriptionAnalysis {
  return {
    links: [
      { url: 'https://github.com/example/repo', type: 'github', label: 'Source Code' },
      { url: 'https://docs.example.com', type: 'documentation', label: 'Documentation' },
    ],
    resources: [
      { name: 'Getting Started Guide', url: 'https://example.com/guide' },
    ],
    relatedVideos: [
      { title: 'Part 2: Advanced Topics', url: 'https://youtube.com/watch?v=abc123' },
    ],
    socialLinks: [
      { platform: 'twitter', url: 'https://twitter.com/example' },
      { platform: 'discord', url: 'https://discord.gg/example' },
    ],
  };
}

// ─────────────────────────────────────────────────────
// Mock Video Factory
// ─────────────────────────────────────────────────────

interface MockVideoData {
  video: VideoResponse;
  summary: VideoSummary;
}

function createMockVideo(
  category: VideoCategory,
  title: string,
  channel: string,
  chapters: SummaryChapter[],
  tldr: string,
  keyTakeaways: string[]
): MockVideoData {
  const id = uuid();
  const videoSummaryId = uuid();
  const youtubeId = `mock_${category}_${id.slice(0, 8)}`;

  const context: VideoContext = {
    category,
    youtubeCategory: getCategoryYouTubeMapping(category),
    tags: [category, 'tutorial', 'guide'],
    displayTags: [category.charAt(0).toUpperCase() + category.slice(1), 'Tutorial'],
  };

  const video: VideoResponse = {
    id,
    videoSummaryId,
    youtubeId,
    title,
    channel,
    duration: chapters.length * 300,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
    status: 'completed',
    folderId: null,
    createdAt: new Date().toISOString(),
    context,
    descriptionAnalysis: createMockDescriptionAnalysis(),
  };

  const summary: VideoSummary = {
    tldr,
    keyTakeaways,
    chapters,
    concepts: [
      { id: uuid(), name: 'Key Concept', definition: 'Main idea covered in this video', timestamp: '2:00' },
    ],
  };

  return { video, summary };
}

function getCategoryYouTubeMapping(category: VideoCategory): string {
  const mapping: Record<VideoCategory, string> = {
    cooking: 'Howto & Style',
    coding: 'Science & Technology',
    travel: 'Travel & Events',
    reviews: 'Science & Technology',
    fitness: 'Sports',
    education: 'Education',
    podcast: 'Entertainment',
    diy: 'Howto & Style',
    gaming: 'Gaming',
    standard: 'Entertainment',
  };
  return mapping[category];
}

// ─────────────────────────────────────────────────────
// Category-Specific Mock Videos
// ─────────────────────────────────────────────────────

export const mockVideos: Record<VideoCategory, MockVideoData> = {
  cooking: createMockVideo(
    'cooking',
    "Gordon Ramsay's Perfect Carbonara",
    'Gordon Ramsay',
    [
      createChapter(0, 'Introduction', [
        createParagraphBlock("Today I'll teach you how to make the perfect carbonara - the authentic Roman way."),
        createTimestampBlock('0:30', 30, 'Recipe overview'),
      ]),
      createChapter(1, 'Ingredients', [
        createIngredientBlock([
          { name: 'Spaghetti', amount: '400', unit: 'g' },
          { name: 'Guanciale', amount: '200', unit: 'g', notes: 'or pancetta' },
          { name: 'Egg yolks', amount: '6' },
          { name: 'Pecorino Romano', amount: '100', unit: 'g', notes: 'freshly grated' },
          { name: 'Black pepper', amount: '1', unit: 'tbsp', notes: 'freshly ground' },
        ], 4),
        createCalloutBlock('chef_tip', 'Use guanciale for authentic flavor - pancetta is a good substitute.'),
      ]),
      createChapter(2, 'Preparing the Sauce', [
        createStepBlock([
          { number: 1, instruction: 'Mix egg yolks with grated pecorino', tips: 'Reserve pasta water' },
          { number: 2, instruction: 'Add generous amount of black pepper' },
          { number: 3, instruction: 'Whisk until smooth and creamy' },
        ]),
      ]),
      createChapter(3, 'Cooking the Pasta', [
        createStepBlock([
          { number: 1, instruction: 'Bring large pot of salted water to boil', duration: 300 },
          { number: 2, instruction: 'Cook pasta until al dente', duration: 480, tips: 'Check 1 minute before package time' },
          { number: 3, instruction: 'Reserve 1 cup pasta water before draining' },
        ]),
        createCalloutBlock('warning', 'Do NOT rinse the pasta - you need the starch!'),
      ]),
      createChapter(4, 'Final Assembly', [
        createParagraphBlock('The key to perfect carbonara is controlling the temperature.'),
        createStepBlock([
          { number: 1, instruction: 'Render guanciale until crispy, remove from heat' },
          { number: 2, instruction: 'Add hot pasta to the pan OFF the heat' },
          { number: 3, instruction: 'Quickly add egg mixture, tossing constantly' },
          { number: 4, instruction: 'Add pasta water if needed for creaminess' },
        ]),
        createNutritionBlock([
          { nutrient: 'Calories', amount: '650', unit: 'kcal' },
          { nutrient: 'Protein', amount: '28', unit: 'g' },
          { nutrient: 'Fat', amount: '32', unit: 'g' },
          { nutrient: 'Carbs', amount: '58', unit: 'g' },
        ], '1 serving'),
      ]),
    ],
    'Master the authentic Roman carbonara with guanciale, pecorino, and perfectly emulsified egg sauce.',
    ['Use guanciale for authentic flavor', 'Never add cream - it\'s not traditional', 'Control temperature to avoid scrambled eggs', 'Reserve pasta water for the sauce']
  ),

  coding: createMockVideo(
    'coding',
    'React 19 Hooks Complete Tutorial',
    'Fireship',
    [
      createChapter(0, "What's New in React 19", [
        createParagraphBlock('React 19 brings major improvements to hooks and introduces new patterns.'),
        createBulletsBlock(['use() hook for promises', 'Form actions', 'Optimistic updates', 'Document metadata']),
      ]),
      createChapter(1, 'Project Setup', [
        createTerminalBlock('npm create vite@latest my-app -- --template react-ts', 'Creating new project...'),
        createFileTreeBlock([
          { name: 'src', type: 'folder', expanded: true, children: [
            { name: 'components', type: 'folder', children: [] },
            { name: 'hooks', type: 'folder', children: [] },
            { name: 'App.tsx', type: 'file' },
            { name: 'main.tsx', type: 'file' },
          ]},
          { name: 'package.json', type: 'file' },
        ]),
        createTerminalBlock('npm install', 'added 145 packages'),
      ]),
      createChapter(2, 'useState Deep Dive', [
        createCodeBlock(
`function Counter() {
  const [count, setCount] = useState(0);

  // Functional update pattern
  const increment = () => setCount(c => c + 1);

  return <button onClick={increment}>{count}</button>;
}`,
          'typescript',
          'Counter.tsx',
          [4]
        ),
        createCalloutBlock('tip', 'Use functional updates when the new state depends on the previous state.'),
      ]),
      createChapter(3, 'useEffect Patterns', [
        createCodeBlock(
`useEffect(() => {
  const controller = new AbortController();

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData);

  return () => controller.abort();
}, []);`,
          'typescript',
          'DataFetcher.tsx'
        ),
        createCalloutBlock('warning', 'Always clean up subscriptions and abort fetch requests.'),
      ]),
      createChapter(4, 'Custom Hooks', [
        createCodeBlock(
`function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}`,
          'typescript',
          'useLocalStorage.ts'
        ),
        createParagraphBlock('Custom hooks let you extract and reuse stateful logic across components.'),
      ]),
    ],
    'Complete guide to React 19 hooks including useState, useEffect, and custom hooks with TypeScript.',
    ['Functional updates prevent stale closure bugs', 'Always clean up effects', 'Custom hooks extract reusable logic', 'TypeScript improves hook type safety']
  ),

  fitness: createMockVideo(
    'fitness',
    '30-Min Full Body HIIT Workout',
    'THENX',
    [
      createChapter(0, 'Warm Up', [
        createExerciseBlock([
          { name: 'Jumping Jacks', duration: '60s', difficulty: 'beginner' },
          { name: 'High Knees', duration: '60s', difficulty: 'beginner' },
          { name: 'Arm Circles', duration: '30s', difficulty: 'beginner' },
          { name: 'Leg Swings', duration: '30s', difficulty: 'beginner' },
        ]),
        createCalloutBlock('warning', 'Never skip warm-up to prevent injuries.'),
      ]),
      createChapter(1, 'Circuit 1: Upper Body', [
        createExerciseBlock([
          { name: 'Push-ups', sets: 3, reps: '15', rest: '30s', difficulty: 'intermediate' },
          { name: 'Diamond Push-ups', sets: 3, reps: '10', rest: '30s', difficulty: 'advanced' },
          { name: 'Pike Push-ups', sets: 3, reps: '12', rest: '30s', difficulty: 'intermediate' },
        ]),
        createWorkoutTimerBlock([
          { name: 'Work', duration: 45, type: 'work' },
          { name: 'Rest', duration: 15, type: 'rest' },
        ], 3),
      ]),
      createChapter(2, 'Circuit 2: Lower Body', [
        createExerciseBlock([
          { name: 'Squats', sets: 3, reps: '20', rest: '30s', difficulty: 'beginner' },
          { name: 'Lunges', sets: 3, reps: '12 each', rest: '30s', difficulty: 'intermediate' },
          { name: 'Jump Squats', sets: 3, reps: '15', rest: '45s', difficulty: 'advanced' },
        ]),
      ]),
      createChapter(3, 'Circuit 3: Core', [
        createExerciseBlock([
          { name: 'Plank', duration: '45s', sets: 3, rest: '15s', difficulty: 'intermediate' },
          { name: 'Mountain Climbers', duration: '30s', sets: 3, rest: '15s', difficulty: 'intermediate' },
          { name: 'Bicycle Crunches', reps: '20 each', sets: 3, rest: '15s', difficulty: 'beginner' },
        ]),
        createStatisticBlock([
          { value: '300', label: 'Calories Burned', context: 'average' },
          { value: '85%', label: 'Max Heart Rate', trend: 'up' },
        ]),
      ]),
      createChapter(4, 'Cool Down', [
        createExerciseBlock([
          { name: 'Standing Quad Stretch', duration: '30s each', difficulty: 'beginner' },
          { name: 'Hamstring Stretch', duration: '30s each', difficulty: 'beginner' },
          { name: 'Child\'s Pose', duration: '60s', difficulty: 'beginner' },
        ]),
        createCalloutBlock('tip', 'Hold each stretch for at least 30 seconds for maximum benefit.'),
      ]),
    ],
    'High-intensity 30-minute workout targeting all major muscle groups with no equipment needed.',
    ['Warm up prevents injuries', 'HIIT burns more calories than steady cardio', 'Rest is part of the workout', 'Cool down aids recovery']
  ),

  travel: createMockVideo(
    'travel',
    '7 Days in Japan Complete Guide',
    'Kara and Nate',
    [
      createChapter(0, 'Planning Your Trip', [
        createParagraphBlock('Japan is an incredible destination that requires some preparation to maximize your experience.'),
        createBulletsBlock([
          'Best time to visit: March-May or October-November',
          'Get a JR Pass before arrival (saves money)',
          'Download offline maps and translation apps',
          'Book popular restaurants in advance',
        ]),
        createCostBlock([
          { category: 'Flights', amount: 1200, notes: 'Round trip from US' },
          { category: 'JR Pass (7 days)', amount: 200 },
          { category: 'Accommodation', amount: 700, notes: '7 nights' },
          { category: 'Food', amount: 350 },
          { category: 'Activities', amount: 200 },
        ], 2650, 'USD'),
      ]),
      createChapter(1, 'Days 1-2: Tokyo', [
        createLocationBlock('Senso-ji Temple', 'Asakusa, Tokyo', 'Tokyo\'s oldest and most significant temple', { lat: 35.7148, lng: 139.7967 }),
        createItineraryBlock([
          { day: 1, title: 'Exploring East Tokyo', activities: [
            { time: '09:00', activity: 'Senso-ji Temple', location: 'Asakusa', duration: '2 hours' },
            { time: '12:00', activity: 'Ramen lunch', location: 'Ueno', notes: 'Try Ichiran!' },
            { time: '14:00', activity: 'Akihabara exploration', duration: '3 hours' },
            { time: '19:00', activity: 'Shibuya Crossing & dinner', location: 'Shibuya' },
          ]},
          { day: 2, title: 'West Tokyo', activities: [
            { time: '10:00', activity: 'Meiji Shrine', location: 'Harajuku', duration: '1.5 hours' },
            { time: '13:00', activity: 'Takeshita Street', location: 'Harajuku' },
            { time: '16:00', activity: 'Shinjuku Gyoen Garden', duration: '2 hours' },
          ]},
        ]),
      ]),
      createChapter(2, 'Day 3: Day Trip to Nikko', [
        createLocationBlock('Toshogu Shrine', 'Nikko, Tochigi', 'UNESCO World Heritage shrine complex'),
        createCalloutBlock('tip', 'Buy the combo pass for all Nikko shrines - saves time and money.'),
      ]),
      createChapter(3, 'Days 4-5: Kyoto', [
        createLocationBlock('Fushimi Inari Shrine', 'Kyoto', 'Famous for thousands of vermillion torii gates', { lat: 34.9671, lng: 135.7727 }),
        createItineraryBlock([
          { day: 4, title: 'Eastern Kyoto', activities: [
            { time: '06:00', activity: 'Fushimi Inari Shrine', notes: 'Go early to avoid crowds!' },
            { time: '10:00', activity: 'Gion District walk', location: 'Gion' },
            { time: '14:00', activity: 'Kiyomizu-dera Temple' },
          ]},
          { day: 5, title: 'Western Kyoto', activities: [
            { time: '09:00', activity: 'Arashiyama Bamboo Grove', notes: 'Magical in morning light' },
            { time: '12:00', activity: 'Monkey Park', location: 'Arashiyama' },
          ]},
        ]),
      ]),
      createChapter(4, 'Days 6-7: Osaka & Nara', [
        createLocationBlock('Dotonbori', 'Osaka', 'Famous food street with neon lights'),
        createBulletsBlock([
          'Nara Park deer are friendly but can be pushy',
          'Osaka is Japan\'s food capital',
          'Try takoyaki and okonomiyaki',
          'Dotonbori is best at night',
        ]),
        createCalloutBlock('tip', 'Nara is an easy day trip from Osaka - only 45 minutes by train.'),
      ]),
    ],
    'Complete 7-day Japan itinerary covering Tokyo, Nikko, Kyoto, Osaka, and Nara with budget tips.',
    ['Book JR Pass before arriving', 'Visit popular spots early morning', 'Cash is still king in Japan', 'Learn basic Japanese phrases']
  ),

  education: createMockVideo(
    'education',
    'Quantum Computing Explained',
    '3Blue1Brown',
    [
      createChapter(0, 'Classical vs Quantum', [
        createParagraphBlock('Classical computers use bits (0 or 1). Quantum computers use qubits that can be in superposition.'),
        createComparisonBlock(
          { label: 'Classical Bit', items: ['Definite state: 0 OR 1', 'Deterministic', 'Easy to copy'] },
          { label: 'Qubit', items: ['Superposition: 0 AND 1', 'Probabilistic', 'Cannot be copied (no-cloning theorem)'] },
          'versus'
        ),
      ]),
      createChapter(1, 'Understanding Qubits', [
        createDefinitionBlock('Qubit', 'A quantum bit that can exist in a superposition of states until measured.'),
        createFormulaBlock('|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle', 'Qubit state representation where α and β are complex amplitudes'),
        createCalloutBlock('note', 'The probability of measuring 0 is |α|² and measuring 1 is |β|².'),
      ]),
      createChapter(2, 'Superposition', [
        createParagraphBlock('Superposition allows qubits to process multiple possibilities simultaneously.'),
        createFormulaBlock('|\\alpha|^2 + |\\beta|^2 = 1', 'Normalization condition - probabilities must sum to 1'),
        createStatisticBlock([
          { value: '2^n', label: 'States with n qubits', context: 'vs n states classically' },
          { value: '1000x', label: 'Potential speedup', context: 'for certain problems' },
        ]),
      ]),
      createChapter(3, 'Quantum Entanglement', [
        createDefinitionBlock('Entanglement', 'A quantum phenomenon where particles become correlated and the state of one instantly affects the other.'),
        createQuoteBlock('Spooky action at a distance', 'Albert Einstein', undefined, 'speaker'),
        createCalloutBlock('tip', 'Entanglement is not faster-than-light communication - you cannot transmit information this way.'),
      ]),
      createChapter(4, 'Quiz: Test Your Understanding', [
        createQuizBlock([
          {
            question: 'What can a qubit do that a classical bit cannot?',
            options: ['Store more data', 'Exist in superposition', 'Run faster', 'Use less power'],
            correctIndex: 1,
            explanation: 'Qubits can exist in a superposition of 0 and 1 simultaneously.',
          },
          {
            question: 'What happens when you measure a qubit in superposition?',
            options: ['It stays in superposition', 'It collapses to 0 or 1', 'It disappears', 'It duplicates'],
            correctIndex: 1,
            explanation: 'Measurement collapses the superposition to a definite state.',
          },
        ]),
      ]),
    ],
    'Understand the fundamentals of quantum computing including qubits, superposition, and entanglement.',
    ['Qubits use superposition unlike classical bits', 'Measurement collapses quantum states', 'Entanglement enables quantum speedups', 'Quantum computers excel at specific problems']
  ),

  podcast: createMockVideo(
    'podcast',
    'Lex Fridman #400: Naval Ravikant on Wealth and Happiness',
    'Lex Fridman Podcast',
    [
      createChapter(0, 'Introduction', [
        createGuestBlock([{
          name: 'Naval Ravikant',
          title: 'Entrepreneur, Angel Investor',
          bio: 'Co-founder of AngelList. Known for his insights on wealth creation and happiness.',
          socialLinks: [{ platform: 'twitter', url: 'https://twitter.com/naval' }],
        }]),
        createParagraphBlock('Naval returns for his third appearance to discuss the intersection of wealth, happiness, and meaning.'),
      ]),
      createChapter(1, 'Building Wealth', [
        createQuoteBlock('Seek wealth, not money or status. Wealth is having assets that earn while you sleep.', 'Naval Ravikant', 420, 'speaker'),
        createBulletsBlock([
          'Own equity in a business',
          'Build specific knowledge',
          'Leverage through code, media, or capital',
          'Play long-term games with long-term people',
        ]),
      ]),
      createChapter(2, 'The Nature of Happiness', [
        createQuoteBlock('Happiness is the absence of desire. It\'s accepting the present moment.', 'Naval Ravikant', 1800, 'speaker'),
        createParagraphBlock('Naval argues that happiness is a skill that can be trained, not just a result of external circumstances.'),
        createCalloutBlock('note', 'Meditation and mindfulness are technologies for training happiness.'),
      ]),
      createChapter(3, 'Philosophy and Meaning', [
        createQuoteBlock('The meaning of life is to find something you care about deeply and pursue it.', 'Naval Ravikant', 3200, 'speaker'),
        createBulletsBlock([
          'Find your unique intersection of skills',
          'Pursue activities that feel like play to you',
          'Compound your advantages over time',
        ]),
      ]),
      createChapter(4, 'Rapid Fire Questions', [
        createTimestampBlock('1:15:00', 4500, 'Favorite books'),
        createTimestampBlock('1:18:30', 4710, 'Daily routine'),
        createTimestampBlock('1:22:00', 4920, 'Advice for young people'),
        createParagraphBlock('Naval shares his current reading list and discusses his approach to learning and growth.'),
      ]),
    ],
    'Naval Ravikant shares timeless wisdom on building wealth, finding happiness, and living a meaningful life.',
    ['Wealth is assets that earn while you sleep', 'Happiness is a trainable skill', 'Pursue what feels like play', 'Long-term games compound']
  ),

  reviews: createMockVideo(
    'reviews',
    'iPhone 15 Pro Max 6-Month Review',
    'MKBHD',
    [
      createChapter(0, 'Introduction', [
        createParagraphBlock('After 6 months of daily use, here\'s my comprehensive review of the iPhone 15 Pro Max.'),
        createStatisticBlock([
          { value: '6', label: 'Months of Use' },
          { value: '15K+', label: 'Photos Taken' },
          { value: '4.8', label: 'Battery Health %', context: '100%' },
        ]),
      ]),
      createChapter(1, 'Design & Build', [
        createParagraphBlock('The titanium frame is a genuine upgrade - lighter and more durable than stainless steel.'),
        createProConBlock(
          ['Lighter titanium frame', 'Action button is useful', 'USB-C finally', 'Refined matte finish'],
          ['Still a camera bump', 'Fingerprint magnet', 'No color options for Pro']
        ),
        createRatingBlock(9, 10, 'Design', [
          { category: 'Materials', score: 10, maxScore: 10 },
          { category: 'Ergonomics', score: 8, maxScore: 10 },
          { category: 'Durability', score: 9, maxScore: 10 },
        ]),
      ]),
      createChapter(2, 'Camera System', [
        createParagraphBlock('The 5x telephoto is a game-changer for mobile photography.'),
        createStatisticBlock([
          { value: '48MP', label: 'Main Sensor' },
          { value: '5x', label: 'Optical Zoom' },
          { value: '4K120', label: 'Video Recording' },
        ]),
        createRatingBlock(9.5, 10, 'Camera', [
          { category: 'Photo Quality', score: 10, maxScore: 10 },
          { category: 'Video Quality', score: 10, maxScore: 10 },
          { category: 'Low Light', score: 9, maxScore: 10 },
          { category: 'Versatility', score: 9, maxScore: 10 },
        ]),
      ]),
      createChapter(3, 'Performance & Battery', [
        createParagraphBlock('A17 Pro chip handles everything with ease. Gaming performance is desktop-class.'),
        createStatisticBlock([
          { value: '8-9h', label: 'Screen-on Time' },
          { value: '3nm', label: 'Chip Process' },
          { value: '8GB', label: 'RAM' },
        ]),
        createRatingBlock(8.5, 10, 'Performance'),
      ]),
      createChapter(4, 'Final Verdict', [
        createVerdictBlock(
          'recommended',
          'The iPhone 15 Pro Max is the best iPhone ever made. The titanium design, 5x camera, and A17 Pro chip make it worth the upgrade for most users.',
          ['Photography enthusiasts', 'Video creators', 'Power users', 'Those upgrading from iPhone 12 or older'],
          ['Budget-conscious buyers', 'Light phone users', 'Those happy with iPhone 14 Pro']
        ),
        createRatingBlock(9, 10, 'Overall Score', [
          { category: 'Design', score: 9, maxScore: 10 },
          { category: 'Camera', score: 9.5, maxScore: 10 },
          { category: 'Performance', score: 9, maxScore: 10 },
          { category: 'Value', score: 8, maxScore: 10 },
        ]),
      ]),
    ],
    'Comprehensive 6-month review of iPhone 15 Pro Max covering design, camera, performance, and value.',
    ['Titanium frame is lighter and durable', '5x telephoto changes mobile photography', 'A17 Pro handles console-quality games', 'Best iPhone for content creators']
  ),

  gaming: createMockVideo(
    'gaming',
    'Elden Ring Beginner\'s Walkthrough',
    'VaatiVidya',
    [
      createChapter(0, 'Character Creation', [
        createParagraphBlock('Your starting class determines your initial stats and equipment, but any class can become any build.'),
        createComparisonBlock(
          { label: 'Best for Beginners', items: ['Vagabond - balanced stats, good armor', 'Confessor - healing incantations', 'Samurai - strong starting weapon'] },
          { label: 'Challenging Starts', items: ['Wretch - level 1, no equipment', 'Astrologer - squishy mage', 'Prophet - limited weapon options'] },
          'versus'
        ),
        createCalloutBlock('tip', 'Vigor should be your primary stat early game - aim for 40 before other damage stats.'),
      ]),
      createChapter(1, 'Starting Area: Limgrave', [
        createParagraphBlock('Limgrave is a massive open area designed to teach you the game mechanics at your own pace.'),
        createBulletsBlock([
          'Collect Sites of Grace to level up',
          'Find the horse (Torrent) at the Church of Elleh',
          'Talk to Kalé for essential items',
          'Don\'t fight the Tree Sentinel yet!',
        ]),
        createTimestampBlock('5:30', 330, 'Getting Torrent'),
        createTimestampBlock('8:15', 495, 'First map fragment'),
      ]),
      createChapter(2, 'Essential Early Items', [
        createBulletsBlock([
          'Flask of Wondrous Physick - combines effects',
          'Spirit Calling Bell - summon spirits',
          'Whetstone Knife - weapon modifications',
          'Crafting Kit - make items on the go',
        ]),
        createCalloutBlock('note', 'Spirit summons can completely change difficult boss fights.'),
      ]),
      createChapter(3, 'First Boss: Margit', [
        createParagraphBlock('Margit is your first major skill check. Don\'t feel bad about summoning help!'),
        createNumberedBlock([
          'Learn his attack patterns',
          'Stay close for most attacks',
          'Punish after his combo finishers',
          'Use Margit\'s Shackle item for two free hits',
          'Spirit summons draw aggro',
        ]),
        createCalloutBlock('tip', 'If Margit is too hard, explore Limgrave more. Come back at level 25-30.'),
      ]),
      createChapter(4, 'General Tips', [
        createBulletsBlock([
          'Dying is normal - don\'t stress about losing runes',
          'Explore everywhere - secrets are rewarded',
          'Read item descriptions for lore',
          'Co-op summons make bosses easier',
          'Take breaks if frustrated',
        ]),
        createQuoteBlock('Hesitation is defeat.', 'Also applies to Elden Ring', undefined, 'highlight'),
        createStatisticBlock([
          { value: '165+', label: 'Hours Average Playthrough' },
          { value: '130+', label: 'Bosses' },
          { value: '∞', label: 'Deaths (probably)' },
        ]),
      ]),
    ],
    'Complete beginner\'s guide to Elden Ring covering character creation, early game, and essential strategies.',
    ['Vigor is your most important stat early', 'Get Torrent immediately', 'Spirit summons are powerful tools', 'Exploration is always rewarded']
  ),

  diy: createMockVideo(
    'diy',
    'Build a Standing Desk from Scratch',
    'Woodworking for Mere Mortals',
    [
      createChapter(0, 'Tools & Materials', [
        createToolListBlock([
          { name: 'Circular saw or table saw', quantity: '1', notes: 'For cutting plywood' },
          { name: 'Drill/driver', quantity: '1' },
          { name: 'Pocket hole jig', quantity: '1', notes: 'Kreg jig recommended' },
          { name: 'Orbital sander', quantity: '1', notes: '120 and 220 grit paper' },
          { name: 'Clamps', quantity: '4-6', notes: 'Bar or pipe clamps' },
        ]),
        createCostBlock([
          { category: 'Plywood (3/4")', amount: 80, notes: '1 sheet birch' },
          { category: 'Standing desk frame', amount: 200, notes: 'Electric adjustable' },
          { category: 'Wood finish', amount: 35, notes: 'Polyurethane or oil' },
          { category: 'Hardware', amount: 25 },
        ], 340, 'USD'),
      ]),
      createChapter(1, 'Cutting the Desktop', [
        createStepBlock([
          { number: 1, instruction: 'Measure and mark your desktop dimensions', tips: '60" x 30" is a good size' },
          { number: 2, instruction: 'Cut plywood to size with circular saw and guide' },
          { number: 3, instruction: 'Cut edge banding strips (if using)' },
        ]),
        createCalloutBlock('warning', 'Always wear safety glasses and hearing protection when cutting.'),
      ]),
      createChapter(2, 'Edge Treatment', [
        createParagraphBlock('The edges make or break a plywood project. Here are your options:'),
        createBulletsBlock([
          'Iron-on edge banding - quick and clean',
          'Solid wood edging - premium look',
          'Rounded/chamfered - simple sander trick',
          'Live edge - if using slab wood',
        ]),
        createStepBlock([
          { number: 1, instruction: 'Sand all edges smooth with 120 grit' },
          { number: 2, instruction: 'Apply edge treatment of choice' },
          { number: 3, instruction: 'Final sand with 220 grit' },
        ]),
      ]),
      createChapter(3, 'Finishing', [
        createStepBlock([
          { number: 1, instruction: 'Sand entire surface with 120, then 180, then 220 grit' },
          { number: 2, instruction: 'Remove all dust with tack cloth' },
          { number: 3, instruction: 'Apply first coat of finish', duration: 300 },
          { number: 4, instruction: 'Let dry completely (check product instructions)', duration: 14400 },
          { number: 5, instruction: 'Light sand with 320 grit between coats' },
          { number: 6, instruction: 'Apply 2-3 more coats' },
        ]),
        createCalloutBlock('tip', 'For a glass-smooth finish, wet sand the final coat with 400 grit.'),
      ]),
      createChapter(4, 'Assembly & Final Result', [
        createStepBlock([
          { number: 1, instruction: 'Flip desk frame upside down' },
          { number: 2, instruction: 'Center desktop on frame' },
          { number: 3, instruction: 'Mark and pre-drill screw holes' },
          { number: 4, instruction: 'Attach frame to desktop' },
          { number: 5, instruction: 'Flip right side up and test' },
        ]),
        createStatisticBlock([
          { value: '$340', label: 'Total Cost', context: 'vs $800+ retail' },
          { value: '6hrs', label: 'Build Time', context: 'over 2 days' },
          { value: '300lb', label: 'Weight Capacity' },
        ]),
        createCalloutBlock('tip', 'Add cable management clips underneath before flipping!'),
      ]),
    ],
    'Complete guide to building a custom standing desk with an electric frame, saving hundreds vs retail.',
    ['Plywood with edge banding looks professional', 'Electric frames are worth the investment', 'Multiple thin finish coats beat one thick coat', 'Pre-drill everything to avoid splits']
  ),

  standard: createMockVideo(
    'standard',
    'Understanding the Stock Market 2024',
    'Graham Stephan',
    [
      createChapter(0, 'What is the Stock Market?', [
        createParagraphBlock('The stock market is a collection of exchanges where stocks (pieces of ownership in businesses) are bought and sold.'),
        createDefinitionBlock('Stock', 'A share of ownership in a company that entitles you to a portion of its profits and assets.'),
        createDefinitionBlock('Exchange', 'A marketplace where stocks are traded. Examples: NYSE, NASDAQ.'),
      ]),
      createChapter(1, 'Key Concepts', [
        createBulletsBlock([
          'Market Cap: Total value of a company\'s shares',
          'P/E Ratio: Price relative to earnings',
          'Dividend: Profit shared with shareholders',
          'Index: A basket of stocks (like S&P 500)',
        ]),
        createStatisticBlock([
          { value: '~10%', label: 'Avg Annual Return', context: 'S&P 500 historical' },
          { value: '500', label: 'Companies in S&P 500' },
          { value: '$40T+', label: 'US Stock Market Value' },
        ]),
      ]),
      createChapter(2, 'How to Start Investing', [
        createNumberedBlock([
          'Open a brokerage account (Fidelity, Schwab, etc.)',
          'Start with index funds (low risk, diversified)',
          'Set up automatic investments',
          'Invest for the long term (10+ years)',
          'Don\'t panic sell during downturns',
        ]),
        createCalloutBlock('tip', 'Time in the market beats timing the market. Start early, stay consistent.'),
      ]),
      createChapter(3, 'Risk Management', [
        createParagraphBlock('Understanding and managing risk is crucial for long-term investing success.'),
        createBulletsBlock([
          'Diversify across sectors and asset classes',
          'Don\'t invest money you\'ll need soon',
          'Keep 3-6 months expenses in cash',
          'Rebalance portfolio annually',
        ]),
        createCalloutBlock('warning', 'Never invest based on social media hype or FOMO.'),
      ]),
      createChapter(4, 'Summary & Next Steps', [
        createBulletsBlock([
          'The stock market is accessible to everyone',
          'Index funds are great for beginners',
          'Consistency beats trying to time the market',
          'Start small, learn as you go',
        ]),
        createStatisticBlock([
          { value: '$100', label: 'Min to Start', context: 'with fractional shares' },
          { value: '30min', label: 'To Open Account' },
          { value: '∞', label: 'Potential Growth' },
        ]),
      ]),
    ],
    'Beginner-friendly guide to understanding the stock market, key concepts, and how to start investing.',
    ['Index funds are ideal for beginners', 'Time in market beats timing', 'Diversification reduces risk', 'Start early, invest consistently']
  ),
};

// ─────────────────────────────────────────────────────
// Export Helpers
// ─────────────────────────────────────────────────────

export function getAllMockVideos(): MockVideoData[] {
  return Object.values(mockVideos);
}

export function getMockVideo(category: VideoCategory): MockVideoData {
  return mockVideos[category];
}

export function getMockVideoCategories(): VideoCategory[] {
  return Object.keys(mockVideos) as VideoCategory[];
}
