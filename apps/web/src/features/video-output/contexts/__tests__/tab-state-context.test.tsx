import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TabStateProvider, useTabState } from '../TabStateContext';
import type { ReactNode } from 'react';

function createWrapper(videoId = 'test-video') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <TabStateProvider videoId={videoId}>{children}</TabStateProvider>;
  };
}

describe('TabStateContext', () => {
  describe('useTabState outside provider', () => {
    it('returns NOOP context without throwing', () => {
      const { result } = renderHook(() => useTabState());
      expect(result.current.checkedItems.size).toBe(0);
      expect(result.current.completedSteps.size).toBe(0);
      expect(result.current.masteredCards.size).toBe(0);
      expect(result.current.quizResults.size).toBe(0);
    });

    it('NOOP actions do not throw', () => {
      const { result } = renderHook(() => useTabState());
      expect(() => {
        result.current.checkItem('tab', 0);
        result.current.uncheckItem('tab', 0);
        result.current.completeStep(0);
        result.current.uncompleteStep(0);
        result.current.masterCard('0');
        result.current.setQuizResult('0', true);
      }).not.toThrow();
    });

    it('NOOP queries return defaults', () => {
      const { result } = renderHook(() => useTabState());
      expect(result.current.isChecked('tab', 0)).toBe(false);
      expect(result.current.isStepCompleted(0)).toBe(false);
      expect(result.current.getCompletionPercent('tab', 10)).toBe(0);
    });
  });

  describe('checkedItems', () => {
    it('starts empty', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      expect(result.current.checkedItems.size).toBe(0);
    });

    it('checkItem adds to set', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.checkItem('ingredients', 0));
      expect(result.current.isChecked('ingredients', 0)).toBe(true);
      expect(result.current.checkedItems.has('ingredients:0')).toBe(true);
    });

    it('uncheckItem removes from set', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.checkItem('ingredients', 0));
      act(() => result.current.uncheckItem('ingredients', 0));
      expect(result.current.isChecked('ingredients', 0)).toBe(false);
    });

    it('uncheckItem is no-op when item not checked', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      const before = result.current.checkedItems;
      act(() => result.current.uncheckItem('ingredients', 99));
      expect(result.current.checkedItems).toBe(before);
    });
  });

  describe('completedSteps', () => {
    it('completeStep adds to set', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.completeStep(0));
      expect(result.current.isStepCompleted(0)).toBe(true);
    });

    it('uncompleteStep removes from set', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.completeStep(0));
      act(() => result.current.uncompleteStep(0));
      expect(result.current.isStepCompleted(0)).toBe(false);
    });

    it('completeStep is idempotent', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.completeStep(0));
      const after1 = result.current.completedSteps;
      act(() => result.current.completeStep(0));
      expect(result.current.completedSteps).toBe(after1);
    });
  });

  describe('masteredCards', () => {
    it('masterCard adds to set', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.masterCard('3'));
      expect(result.current.masteredCards.has('3')).toBe(true);
    });

    it('masterCard is idempotent', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.masterCard('3'));
      const after1 = result.current.masteredCards;
      act(() => result.current.masterCard('3'));
      expect(result.current.masteredCards).toBe(after1);
    });
  });

  describe('quizResults', () => {
    it('setQuizResult adds to map', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => result.current.setQuizResult('0', true));
      act(() => result.current.setQuizResult('1', false));
      expect(result.current.quizResults.get('0')).toBe(true);
      expect(result.current.quizResults.get('1')).toBe(false);
    });
  });

  describe('getCompletionPercent', () => {
    it('returns 0 when no items checked', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      expect(result.current.getCompletionPercent('ingredients', 5)).toBe(0);
    });

    it('calculates percentage correctly', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      act(() => {
        result.current.checkItem('ingredients', 0);
        result.current.checkItem('ingredients', 1);
      });
      expect(result.current.getCompletionPercent('ingredients', 4)).toBe(50);
    });

    it('returns 0 when totalItems is 0', () => {
      const { result } = renderHook(() => useTabState(), { wrapper: createWrapper() });
      expect(result.current.getCompletionPercent('ingredients', 0)).toBe(0);
    });
  });

  describe('videoId reset', () => {
    it('resets all state when videoId changes', () => {
      let videoId = 'video-1';
      const wrapper = ({ children }: { children: ReactNode }) => (
        <TabStateProvider videoId={videoId}>{children}</TabStateProvider>
      );

      const { result, rerender } = renderHook(() => useTabState(), { wrapper });

      // Add some state
      act(() => {
        result.current.checkItem('ingredients', 0);
        result.current.completeStep(0);
        result.current.masterCard('0');
        result.current.setQuizResult('0', true);
      });

      expect(result.current.checkedItems.size).toBe(1);
      expect(result.current.completedSteps.size).toBe(1);

      // Change videoId
      videoId = 'video-2';
      rerender();

      expect(result.current.checkedItems.size).toBe(0);
      expect(result.current.completedSteps.size).toBe(0);
      expect(result.current.masteredCards.size).toBe(0);
      expect(result.current.quizResults.size).toBe(0);
    });
  });
});
