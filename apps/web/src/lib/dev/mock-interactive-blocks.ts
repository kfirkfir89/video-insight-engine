/**
 * Mock data for interactive block showcases — Dev Only
 *
 * Provides sample data for FlashCard, ScenarioCard, SpotCard, and ScoreRing demos.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('mock-interactive-blocks should not be imported in production');
}

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
