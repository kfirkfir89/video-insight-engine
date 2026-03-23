import { describe, it, expect } from 'vitest';
import { LINK_RULES, resolveCrossTabLinks } from '../link-rules';

describe('link-rules', () => {
  describe('LINK_RULES', () => {
    it('should have at least 20 rules', () => {
      expect(LINK_RULES.length).toBeGreaterThanOrEqual(20);
    });

    it('should have unique source-target pairs', () => {
      const pairs = LINK_RULES.map(r => `${r.sourceTab}->${r.targetTab}`);
      const uniquePairs = new Set(pairs);
      expect(uniquePairs.size).toBe(pairs.length);
    });

    it('should have non-empty labels for all rules', () => {
      LINK_RULES.forEach(rule => {
        expect(rule.label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('resolveCrossTabLinks', () => {
    it('should return empty object when no tabs match', () => {
      const result = resolveCrossTabLinks(['nonexistent-tab']);
      expect(result).toEqual({});
    });

    it('should return links for matching source and target tabs', () => {
      const result = resolveCrossTabLinks(['concepts', 'quizzes']);

      expect(result['concepts']).toBeDefined();
      expect(result['concepts'].length).toBeGreaterThan(0);
      expect(result['concepts'].some(r => r.targetTab === 'quizzes')).toBe(true);
    });

    it('should not include rules where target tab is missing', () => {
      const result = resolveCrossTabLinks(['concepts']);

      // quiz is not in tabs, so concepts->quiz should not be included
      expect(result['concepts']?.some(r => r.targetTab === 'quizzes')).toBeFalsy();
    });

    it('should not include rules where source tab is missing', () => {
      const result = resolveCrossTabLinks(['quizzes']);

      // concepts is not in tabs, so concepts->quiz should not appear under concepts
      expect(result['concepts']).toBeUndefined();
    });

    it('should resolve bidirectional links', () => {
      const result = resolveCrossTabLinks(['concepts', 'quizzes']);

      expect(result['concepts']?.some(r => r.targetTab === 'quizzes')).toBe(true);
      expect(result['quizzes']?.some(r => r.targetTab === 'concepts')).toBe(true);
    });

    it('should resolve recipe-related links', () => {
      const result = resolveCrossTabLinks(['overview', 'steps', 'ingredients', 'nutrition']);

      expect(result['overview']?.some(r => r.targetTab === 'steps')).toBe(true);
      expect(result['ingredients']?.some(r => r.targetTab === 'steps')).toBe(true);
      expect(result['steps']?.some(r => r.targetTab === 'nutrition')).toBe(true);
    });

    it('should handle empty tabs array', () => {
      const result = resolveCrossTabLinks([]);
      expect(result).toEqual({});
    });
  });
});
