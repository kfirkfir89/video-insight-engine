import { describe, it, expect } from 'vitest';
import { getMatchTokens, matchIngredientsToStep, buildStepIngredientMap } from '../ingredient-step-matcher';

describe('ingredient-step-matcher', () => {
  describe('getMatchTokens', () => {
    it('strips common qualifiers', () => {
      expect(getMatchTokens('fresh chicken breast')).toEqual(['chicken', 'breast']);
    });

    it('handles "dried ground cumin"', () => {
      expect(getMatchTokens('dried ground cumin')).toEqual(['cumin']);
    });

    it('returns original words when all are qualifiers', () => {
      expect(getMatchTokens('fresh large')).toEqual(['fresh', 'large']);
    });

    it('lowercases all tokens', () => {
      expect(getMatchTokens('Olive Oil')).toEqual(['olive', 'oil']);
    });

    it('strips non-alpha characters', () => {
      expect(getMatchTokens('1/2 cup flour')).toEqual(['cup', 'flour']);
    });

    it('filters single-char words', () => {
      expect(getMatchTokens('a pinch of salt')).toEqual(['pinch', 'of', 'salt']);
    });
  });

  describe('matchIngredientsToStep', () => {
    const ingredients = [
      { label: 'chicken breast' },
      { label: 'soy sauce' },
      { label: 'fresh garlic' },
      { label: 'olive oil' },
      { label: 'salt' },
    ];

    it('"chicken" matches "Cut the chicken into chunks"', () => {
      const result = matchIngredientsToStep(
        'Cut the chicken into chunks',
        ingredients,
        new Set(),
      );
      expect(result.matchedIndices).toContain(0);
    });

    it('"soy sauce" matches "Add soy sauce to the pan"', () => {
      const result = matchIngredientsToStep(
        'Add soy sauce to the pan',
        ingredients,
        new Set(),
      );
      expect(result.matchedIndices).toContain(1);
    });

    it('"fresh garlic" matches "Mince the garlic" (strips "fresh")', () => {
      const result = matchIngredientsToStep(
        'Mince the garlic',
        ingredients,
        new Set(),
      );
      expect(result.matchedIndices).toContain(2);
    });

    it('"olive oil" matches "heat olive oil"', () => {
      const result = matchIngredientsToStep(
        'heat olive oil in a pan',
        ingredients,
        new Set(),
      );
      expect(result.matchedIndices).toContain(3);
    });

    it('no false match between "salt" and "malt"', () => {
      const result = matchIngredientsToStep(
        'Add malt vinegar',
        ingredients,
        new Set(),
      );
      expect(result.matchedIndices).not.toContain(4);
    });

    it('counts checked ingredients correctly', () => {
      const result = matchIngredientsToStep(
        'Season with salt and garlic',
        ingredients,
        new Set([2, 4]), // garlic and salt are checked
      );
      expect(result.total).toBe(2); // garlic + salt matched
      expect(result.checked).toBe(2); // both checked
    });

    it('handles empty inputs', () => {
      expect(matchIngredientsToStep('do something', [], new Set())).toEqual({
        total: 0,
        checked: 0,
        matchedIndices: [],
      });

      expect(matchIngredientsToStep('', ingredients, new Set())).toEqual({
        total: 0,
        checked: 0,
        matchedIndices: [],
      });
    });
  });

  describe('buildStepIngredientMap', () => {
    it('returns correct mapping', () => {
      const steps = [
        { instruction: 'Heat olive oil in a pan' },
        { instruction: 'Add chicken and cook until golden' },
        { instruction: 'Season with salt and garlic' },
      ];
      const ingredients = [
        { label: 'olive oil' },
        { label: 'chicken breast' },
        { label: 'salt' },
        { label: 'garlic' },
      ];

      const map = buildStepIngredientMap(steps, ingredients);

      expect(map.get(0)).toEqual([0]); // olive oil
      expect(map.get(1)).toEqual([1]); // chicken
      expect(map.get(2)).toEqual(expect.arrayContaining([2, 3])); // salt + garlic
    });

    it('returns empty map for empty inputs', () => {
      expect(buildStepIngredientMap([], []).size).toBe(0);
    });

    it('skips steps with no ingredient matches', () => {
      const steps = [
        { instruction: 'Preheat oven to 350F' },
        { instruction: 'Add butter' },
      ];
      const ingredients = [{ label: 'butter' }];

      const map = buildStepIngredientMap(steps, ingredients);
      expect(map.has(0)).toBe(false);
      expect(map.get(1)).toEqual([0]);
    });
  });
});
