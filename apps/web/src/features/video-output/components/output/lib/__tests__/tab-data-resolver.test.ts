import { describe, it, expect } from 'vitest';
import type { VIEResponse } from '@vie/types';
import { resolveTabData } from '../tab-data-resolver';

const baseMeta = {
  videoId: 'v1',
  videoTitle: 'Test',
  creator: 'Tester',
  contentTags: ['review' as const],
  modifiers: [],
  primaryTag: 'review' as const,
  userGoal: 'Review a product',
};

function buildResponse(overrides: Partial<VIEResponse> = {}): VIEResponse {
  return {
    meta: baseMeta,
    tabs: [],
    ...overrides,
  };
}

describe('resolveTabData', () => {
  describe('review domain', () => {
    const response = buildResponse({
      review: {
        product: 'iPhone 16',
        price: '$999',
        rating: { score: 8, maxScore: 10, label: 'Great' },
        pros: ['Great camera', 'Fast'],
        cons: ['Expensive'],
        specs: [{ key: 'Display', value: '6.1"' }],
        comparisons: [{ feature: 'Camera', thisProduct: '48MP', competitor: '50MP', competitorName: 'Galaxy S24' }],
        verdict: { badge: 'recommended', bestFor: ['Photo lovers'], notFor: ['Budget users'], bottomLine: 'Worth it' },
      },
    });

    it('resolves verdict tab', () => {
      const result = resolveTabData(response, 'verdict', '') as Record<string, unknown>;
      expect(result).toHaveProperty('badge', 'recommended');
      expect(result).toHaveProperty('bottomLine', 'Worth it');
    });

    it('resolves pros_cons tab', () => {
      const result = resolveTabData(response, 'pros_cons', '') as Record<string, unknown>;
      expect(result).toHaveProperty('pros');
      expect(result).toHaveProperty('cons');
      expect(result).toHaveProperty('comparisons');
    });

    it('resolves specs tab', () => {
      const result = resolveTabData(response, 'specs', '') as Array<{ key: string; value: string }>;
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ key: 'Display', value: '6.1"' });
    });
  });

  describe('travel domain', () => {
    const response = buildResponse({
      meta: { ...baseMeta, primaryTag: 'travel' as const, contentTags: ['travel' as const] },
      travel: {
        bestSeason: 'Spring',
        accommodationTips: [],
        transportationTips: [],
        itinerary: [{ day: 1, city: 'Tokyo', spots: [], tips: [] }],
        budget: { total: 3000, currency: 'USD', breakdown: [{ category: 'Hotel', amount: 1500 }] },
        packingList: [{ item: 'Passport', category: 'Documents', essential: true }],
      },
    });

    it('resolves itinerary tab', () => {
      const result = resolveTabData(response, 'itinerary', '') as unknown[];
      expect(result).toHaveLength(1);
    });

    it('resolves budget tab', () => {
      const result = resolveTabData(response, 'budget', '') as Record<string, unknown>;
      expect(result).toHaveProperty('total', 3000);
      expect(result).toHaveProperty('currency', 'USD');
    });

    it('resolves packing tab', () => {
      const result = resolveTabData(response, 'packing', '') as unknown[];
      expect(result).toHaveLength(1);
    });
  });

  describe('enrichment tabs', () => {
    const response = buildResponse({
      quizzes: [{ question: 'Q1', options: [], correctIndex: 0 }],
      flashcards: [{ front: 'Term', back: 'Def' }],
      scenarios: [{ question: 'What if?', options: [] }],
    });

    it('resolves quizzes from root', () => {
      expect(resolveTabData(response, 'quizzes', '')).toHaveLength(1);
    });

    it('resolves flashcards from root', () => {
      expect(resolveTabData(response, 'flashcards', '')).toHaveLength(1);
    });

    it('resolves scenarios from root', () => {
      expect(resolveTabData(response, 'scenarios', '')).toHaveLength(1);
    });
  });

  describe('null domain', () => {
    const response = buildResponse();

    it('returns null/undefined when domain is missing', () => {
      // Both resolve to nullish (null or undefined depending on optional chaining)
      expect(resolveTabData(response, 'verdict', '')).toBeFalsy();
      expect(resolveTabData(response, 'itinerary', '')).toBeFalsy();
    });
  });

  describe('unknown tab ID falls back to dataSource', () => {
    const response = buildResponse({
      learning: {
        keyPoints: [{ emoji: '📌', title: 'Point', detail: 'Detail' }],
        concepts: [],
        takeaways: [],
        timestamps: [],
      },
    });

    it('resolves via dataSource for unknown tab', () => {
      const result = resolveTabData(response, 'custom_tab', 'learning.keyPoints');
      expect(result).toHaveLength(1);
    });
  });

  describe('overview composite', () => {
    it('builds overview from primary domain primitives', () => {
      const response = buildResponse({
        review: {
          product: 'iPhone 16',
          price: '$999',
          rating: { score: 8, maxScore: 10, label: 'Great' },
          pros: [],
          cons: [],
          specs: [],
          comparisons: [],
          verdict: { badge: 'recommended', bestFor: [], notFor: [], bottomLine: '' },
        },
      });
      const result = resolveTabData(response, 'overview', '') as Record<string, unknown>;
      expect(result).toHaveProperty('product', 'iPhone 16');
      expect(result).toHaveProperty('price', '$999');
      // Rating sub-object primitives are flattened
      expect(result).toHaveProperty('score', 8);
    });
  });

  describe('cross-domain fallback', () => {
    it('steps resolves from food or project', () => {
      const response = buildResponse({
        meta: { ...baseMeta, primaryTag: 'food' as const },
        food: {
          meta: { servings: 4 },
          ingredients: [],
          steps: [{ number: 1, instruction: 'Boil water' }],
          tips: [],
          substitutions: [],
          nutrition: [],
          equipment: [],
        },
      });
      const result = resolveTabData(response, 'steps', '') as unknown[];
      expect(result).toHaveLength(1);
    });

    it('takeaways resolves from learning or narrative', () => {
      const response = buildResponse({
        narrative: { keyMoments: [], quotes: [], takeaways: ['Key insight'] },
      });
      const result = resolveTabData(response, 'takeaways', '') as string[];
      expect(result).toEqual(['Key insight']);
    });
  });
});
