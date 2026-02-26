/**
 * Unit tests for mock block factories
 *
 * Tests all 31 block type factories for correct structure and types.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env.DEV to be true for tests
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: true,
    },
  },
});

import {
  createParagraphBlock,
  createBulletsBlock,
  createNumberedBlock,
  createDoDoNotBlock,
  createExampleBlock,
  createCalloutBlock,
  createDefinitionBlock,
  createKeyValueBlock,
  createComparisonBlock,
  createTimestampBlock,
  createQuoteBlock,
  createStatisticBlock,
  createTranscriptBlock,
  createTimelineBlock,
  createToolListBlock,
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
  sampleBlocks,
  BLOCK_TYPE_COUNT,
} from '../mock-blocks';

describe('mock-blocks factories', () => {
  // ─────────────────────────────────────────────────────
  // Universal Blocks (12)
  // ─────────────────────────────────────────────────────
  describe('Universal blocks', () => {
    it('createParagraphBlock creates valid paragraph', () => {
      const block = createParagraphBlock('Test text');
      expect(block.type).toBe('paragraph');
      expect(block.text).toBe('Test text');
      expect(block.blockId).toBeDefined();
      expect(typeof block.blockId).toBe('string');
    });

    it('createBulletsBlock creates valid bullets', () => {
      const items = ['Item 1', 'Item 2'];
      const block = createBulletsBlock(items, 'checklist');
      expect(block.type).toBe('bullets');
      expect(block.items).toEqual(items);
      expect(block.variant).toBe('checklist');
      expect(block.blockId).toBeDefined();
    });

    it('createNumberedBlock creates valid numbered list', () => {
      const items = ['Step 1', 'Step 2'];
      const block = createNumberedBlock(items, 'cooking_steps');
      expect(block.type).toBe('numbered');
      expect(block.items).toEqual(items);
      expect(block.variant).toBe('cooking_steps');
    });

    it('createDoDoNotBlock creates valid do/dont', () => {
      const doItems = ['Do this'];
      const dontItems = ["Don't do this"];
      const block = createDoDoNotBlock(doItems, dontItems);
      expect(block.type).toBe('do_dont');
      expect(block.do).toEqual(doItems);
      expect(block.dont).toEqual(dontItems);
    });

    it('createExampleBlock creates valid example', () => {
      const block = createExampleBlock('code here', 'Title', 'Explanation', 'terminal_command');
      expect(block.type).toBe('example');
      expect(block.code).toBe('code here');
      expect(block.title).toBe('Title');
      expect(block.explanation).toBe('Explanation');
      expect(block.variant).toBe('terminal_command');
    });

    it('createCalloutBlock creates valid callout with all styles', () => {
      const styles = ['tip', 'warning', 'note', 'chef_tip', 'security'] as const;
      for (const style of styles) {
        const block = createCalloutBlock(style, `${style} text`);
        expect(block.type).toBe('callout');
        expect(block.style).toBe(style);
        expect(block.text).toBe(`${style} text`);
      }
    });

    it('createDefinitionBlock creates valid definition', () => {
      const block = createDefinitionBlock('Term', 'Meaning');
      expect(block.type).toBe('definition');
      expect(block.term).toBe('Term');
      expect(block.meaning).toBe('Meaning');
    });

    it('createKeyValueBlock creates valid key-value pairs', () => {
      const items = [{ key: 'Version', value: '1.0' }];
      const block = createKeyValueBlock(items, 'specs');
      expect(block.type).toBe('keyvalue');
      expect(block.items).toEqual(items);
      expect(block.variant).toBe('specs');
    });

    it('createComparisonBlock creates valid comparison', () => {
      const left = { label: 'Left', items: ['A'] };
      const right = { label: 'Right', items: ['B'] };
      const block = createComparisonBlock(left, right, 'versus');
      expect(block.type).toBe('comparison');
      expect(block.left).toEqual(left);
      expect(block.right).toEqual(right);
      expect(block.variant).toBe('versus');
    });

    it('createTimestampBlock creates valid timestamp', () => {
      const block = createTimestampBlock('5:30', 330, 'Key moment');
      expect(block.type).toBe('timestamp');
      expect(block.time).toBe('5:30');
      expect(block.seconds).toBe(330);
      expect(block.label).toBe('Key moment');
    });

    it('createQuoteBlock creates valid quote', () => {
      const block = createQuoteBlock('Quote text', 'Author', 120, 'speaker');
      expect(block.type).toBe('quote');
      expect(block.text).toBe('Quote text');
      expect(block.attribution).toBe('Author');
      expect(block.timestamp).toBe(120);
      expect(block.variant).toBe('speaker');
    });

    it('createStatisticBlock creates valid statistics', () => {
      const items = [{ value: '85%', label: 'Score', trend: 'up' as const }];
      const block = createStatisticBlock(items, 'percentage');
      expect(block.type).toBe('statistic');
      expect(block.items).toEqual(items);
      expect(block.variant).toBe('percentage');
    });
  });

  // ─────────────────────────────────────────────────────
  // New Universal Blocks (3)
  // ─────────────────────────────────────────────────────
  describe('New universal blocks', () => {
    it('createTranscriptBlock creates valid transcript', () => {
      const lines = [{ time: '0:00', seconds: 0, text: 'Hello' }];
      const block = createTranscriptBlock(lines);
      expect(block.type).toBe('transcript');
      expect(block.lines).toEqual(lines);
    });

    it('createTimelineBlock creates valid timeline', () => {
      const events = [{ date: '2024', title: 'Event', description: 'Desc' }];
      const block = createTimelineBlock(events);
      expect(block.type).toBe('timeline');
      expect(block.events).toEqual(events);
    });

    it('createToolListBlock creates valid tool list', () => {
      const tools = [{ name: 'Hammer', quantity: '1', notes: 'Steel' }];
      const block = createToolListBlock(tools);
      expect(block.type).toBe('tool_list');
      expect(block.tools).toEqual(tools);
    });
  });

  // ─────────────────────────────────────────────────────
  // Cooking Blocks (3)
  // ─────────────────────────────────────────────────────
  describe('Cooking blocks', () => {
    it('createIngredientBlock creates valid ingredients', () => {
      const items = [{ name: 'Salt', amount: '1', unit: 'tsp' }];
      const block = createIngredientBlock(items, 4);
      expect(block.type).toBe('ingredient');
      expect(block.items).toEqual(items);
      expect(block.servings).toBe(4);
    });

    it('createStepBlock creates valid cooking steps', () => {
      const steps = [{ number: 1, instruction: 'Mix', duration: 300 }];
      const block = createStepBlock(steps);
      expect(block.type).toBe('step');
      expect(block.steps).toEqual(steps);
    });

    it('createNutritionBlock creates valid nutrition info', () => {
      const items = [{ nutrient: 'Calories', amount: '200', unit: 'kcal' }];
      const block = createNutritionBlock(items, '1 serving');
      expect(block.type).toBe('nutrition');
      expect(block.items).toEqual(items);
      expect(block.servingSize).toBe('1 serving');
    });
  });

  // ─────────────────────────────────────────────────────
  // Coding Blocks (3)
  // ─────────────────────────────────────────────────────
  describe('Coding blocks', () => {
    it('createCodeBlock creates valid code block', () => {
      const block = createCodeBlock('const x = 1;', 'typescript', 'app.ts', [1]);
      expect(block.type).toBe('code');
      expect(block.code).toBe('const x = 1;');
      expect(block.language).toBe('typescript');
      expect(block.filename).toBe('app.ts');
      expect(block.highlightLines).toEqual([1]);
    });

    it('createTerminalBlock creates valid terminal', () => {
      const block = createTerminalBlock('npm install', 'Done!');
      expect(block.type).toBe('terminal');
      expect(block.command).toBe('npm install');
      expect(block.output).toBe('Done!');
    });

    it('createFileTreeBlock creates valid file tree', () => {
      const tree = [{ name: 'src', type: 'folder' as const, children: [] }];
      const block = createFileTreeBlock(tree);
      expect(block.type).toBe('file_tree');
      expect(block.tree).toEqual(tree);
    });
  });

  // ─────────────────────────────────────────────────────
  // Travel Blocks (3)
  // ─────────────────────────────────────────────────────
  describe('Travel blocks', () => {
    it('createLocationBlock creates valid location', () => {
      const block = createLocationBlock('Tokyo Tower', '123 Main St', 'Landmark', { lat: 35.6, lng: 139.7 });
      expect(block.type).toBe('location');
      expect(block.name).toBe('Tokyo Tower');
      expect(block.address).toBe('123 Main St');
      expect(block.coordinates).toEqual({ lat: 35.6, lng: 139.7 });
    });

    it('createItineraryBlock creates valid itinerary', () => {
      const days = [{ day: 1, title: 'Day 1', activities: [{ activity: 'Visit temple' }] }];
      const block = createItineraryBlock(days);
      expect(block.type).toBe('itinerary');
      expect(block.days).toEqual(days);
    });

    it('createCostBlock creates valid cost breakdown', () => {
      const items = [{ category: 'Food', amount: 100 }];
      const block = createCostBlock(items, 100, 'USD');
      expect(block.type).toBe('cost');
      expect(block.items).toEqual(items);
      expect(block.total).toBe(100);
      expect(block.currency).toBe('USD');
    });
  });

  // ─────────────────────────────────────────────────────
  // Review Blocks (3)
  // ─────────────────────────────────────────────────────
  describe('Review blocks', () => {
    it('createProConBlock creates valid pros/cons', () => {
      const block = createProConBlock(['Good'], ['Bad']);
      expect(block.type).toBe('pro_con');
      expect(block.pros).toEqual(['Good']);
      expect(block.cons).toEqual(['Bad']);
    });

    it('createRatingBlock creates valid rating', () => {
      const breakdown = [{ category: 'Quality', score: 8 }];
      const block = createRatingBlock(8.5, 10, 'Overall', breakdown);
      expect(block.type).toBe('rating');
      expect(block.score).toBe(8.5);
      expect(block.maxScore).toBe(10);
      expect(block.label).toBe('Overall');
      expect(block.breakdown).toEqual(breakdown);
    });

    it('createVerdictBlock creates valid verdict', () => {
      const block = createVerdictBlock('recommended', 'Great product', ['Pros'], ['Cons']);
      expect(block.type).toBe('verdict');
      expect(block.verdict).toBe('recommended');
      expect(block.summary).toBe('Great product');
      expect(block.bestFor).toEqual(['Pros']);
      expect(block.notFor).toEqual(['Cons']);
    });
  });

  // ─────────────────────────────────────────────────────
  // Fitness Blocks (2)
  // ─────────────────────────────────────────────────────
  describe('Fitness blocks', () => {
    it('createExerciseBlock creates valid exercises', () => {
      const exercises = [{ name: 'Push-ups', sets: 3, reps: '10', difficulty: 'beginner' as const }];
      const block = createExerciseBlock(exercises);
      expect(block.type).toBe('exercise');
      expect(block.exercises).toEqual(exercises);
    });

    it('createWorkoutTimerBlock creates valid timer', () => {
      const intervals = [{ name: 'Work', duration: 30, type: 'work' as const }];
      const block = createWorkoutTimerBlock(intervals, 3);
      expect(block.type).toBe('workout_timer');
      expect(block.intervals).toEqual(intervals);
      expect(block.rounds).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────
  // Education Blocks (2)
  // ─────────────────────────────────────────────────────
  describe('Education blocks', () => {
    it('createQuizBlock creates valid quiz', () => {
      const questions = [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0 }];
      const block = createQuizBlock(questions);
      expect(block.type).toBe('quiz');
      expect(block.questions).toEqual(questions);
    });

    it('createFormulaBlock creates valid formula', () => {
      const block = createFormulaBlock('E=mc^2', 'Einstein', false);
      expect(block.type).toBe('formula');
      expect(block.latex).toBe('E=mc^2');
      expect(block.description).toBe('Einstein');
      expect(block.inline).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // Podcast Blocks (1)
  // ─────────────────────────────────────────────────────
  describe('Podcast blocks', () => {
    it('createGuestBlock creates valid guest', () => {
      const guests = [{ name: 'John Doe', title: 'CEO', bio: 'Expert' }];
      const block = createGuestBlock(guests);
      expect(block.type).toBe('guest');
      expect(block.guests).toEqual(guests);
    });
  });

  // ─────────────────────────────────────────────────────
  // Unique IDs
  // ─────────────────────────────────────────────────────
  describe('Block ID uniqueness', () => {
    it('generates unique blockIds for each call', () => {
      const block1 = createParagraphBlock('text');
      const block2 = createParagraphBlock('text');
      expect(block1.blockId).not.toBe(block2.blockId);
    });

    it('generates valid UUID format', () => {
      const block = createParagraphBlock('text');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(block.blockId).toMatch(uuidRegex);
    });
  });

  // ─────────────────────────────────────────────────────
  // Sample Blocks
  // ─────────────────────────────────────────────────────
  describe('sampleBlocks', () => {
    it('contains all expected block types', () => {
      const expectedTypes = [
        'paragraph',
        'bullets',
        'numbered',
        'do_dont',
        'example',
        'callout_tip',
        'callout_warning',
        'callout_note',
        'callout_chef_tip',
        'callout_security',
        'definition',
        'keyvalue',
        'comparison',
        'timestamp',
        'quote',
        'statistic',
        'transcript',
        'timeline',
        'tool_list',
        'ingredient',
        'step',
        'nutrition',
        'code',
        'terminal',
        'file_tree',
        'location',
        'itinerary',
        'cost',
        'pro_con',
        'rating',
        'verdict',
        'exercise',
        'workout_timer',
        'quiz',
        'formula',
        'guest',
      ];

      for (const key of expectedTypes) {
        expect(sampleBlocks).toHaveProperty(key);
      }
    });

    it('all sample blocks have valid blockIds', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const [, block] of Object.entries(sampleBlocks)) {
        expect((block as { blockId: string }).blockId).toMatch(uuidRegex);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // Block count verification
  // ─────────────────────────────────────────────────────
  describe('Block type count', () => {
    it('BLOCK_TYPE_COUNT matches sampleBlocks key count', () => {
      // Floor assertion catches accidental removal of block types
      expect(BLOCK_TYPE_COUNT).toBeGreaterThanOrEqual(34);
      // Derivation check confirms no drift between export and source
      expect(BLOCK_TYPE_COUNT).toBe(Object.keys(sampleBlocks).length);
    });
  });
});
