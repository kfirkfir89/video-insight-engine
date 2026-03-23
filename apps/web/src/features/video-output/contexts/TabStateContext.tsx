import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';

// ─── Types ───

interface TabStateContextType {
  /** Set of checked items keyed by "tabId:index" */
  checkedItems: Set<string>;
  /** Set of completed step indices in StepPlayer */
  completedSteps: Set<number>;
  /** Set of mastered card indices in FlashDeck */
  masteredCards: Set<string>;
  /** Map of quiz question index → correct/incorrect */
  quizResults: Map<string, boolean>;

  // Actions
  checkItem: (tabId: string, index: number) => void;
  uncheckItem: (tabId: string, index: number) => void;
  completeStep: (stepIndex: number) => void;
  uncompleteStep: (stepIndex: number) => void;
  masterCard: (cardIndex: string) => void;
  setQuizResult: (questionIndex: string, correct: boolean) => void;

  // Queries
  isChecked: (tabId: string, index: number) => boolean;
  isStepCompleted: (stepIndex: number) => boolean;
  getCompletionPercent: (tabId: string, totalItems: number) => number;
}

// ─── NOOP Context (safe fallback outside provider) ───

const NOOP_CONTEXT: TabStateContextType = {
  checkedItems: new Set(),
  completedSteps: new Set(),
  masteredCards: new Set(),
  quizResults: new Map(),
  checkItem: () => {},
  uncheckItem: () => {},
  completeStep: () => {},
  uncompleteStep: () => {},
  masterCard: () => {},
  setQuizResult: () => {},
  isChecked: () => false,
  isStepCompleted: () => false,
  getCompletionPercent: () => 0,
};

const TabStateContext = createContext<TabStateContextType | null>(null);

// ─── Provider ───

interface TabStateProviderProps {
  videoId: string;
  children: ReactNode;
}

function makeKey(tabId: string, index: number): string {
  return `${tabId}:${index}`;
}

export function TabStateProvider({ videoId, children }: TabStateProviderProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());
  const [quizResults, setQuizResults] = useState<Map<string, boolean>>(new Map());

  // Reset all state when videoId changes
  useEffect(() => {
    setCheckedItems(new Set());
    setCompletedSteps(new Set());
    setMasteredCards(new Set());
    setQuizResults(new Map());
  }, [videoId]);

  // ─── Actions ───

  const checkItem = useCallback((tabId: string, index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.add(makeKey(tabId, index));
      return next;
    });
  }, []);

  const uncheckItem = useCallback((tabId: string, index: number) => {
    setCheckedItems(prev => {
      const key = makeKey(tabId, index);
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const completeStep = useCallback((stepIndex: number) => {
    setCompletedSteps(prev => {
      if (prev.has(stepIndex)) return prev;
      const next = new Set(prev);
      next.add(stepIndex);
      return next;
    });
  }, []);

  const uncompleteStep = useCallback((stepIndex: number) => {
    setCompletedSteps(prev => {
      if (!prev.has(stepIndex)) return prev;
      const next = new Set(prev);
      next.delete(stepIndex);
      return next;
    });
  }, []);

  const masterCard = useCallback((cardIndex: string) => {
    setMasteredCards(prev => {
      if (prev.has(cardIndex)) return prev;
      const next = new Set(prev);
      next.add(cardIndex);
      return next;
    });
  }, []);

  const setQuizResult = useCallback((questionIndex: string, correct: boolean) => {
    setQuizResults(prev => {
      const next = new Map(prev);
      next.set(questionIndex, correct);
      return next;
    });
  }, []);

  // ─── Queries ───

  const isChecked = useCallback((tabId: string, index: number) => {
    return checkedItems.has(makeKey(tabId, index));
  }, [checkedItems]);

  const isStepCompleted = useCallback((stepIndex: number) => {
    return completedSteps.has(stepIndex);
  }, [completedSteps]);

  const getCompletionPercent = useCallback((tabId: string, totalItems: number) => {
    if (totalItems <= 0) return 0;
    let count = 0;
    for (const key of checkedItems) {
      if (key.startsWith(`${tabId}:`)) count++;
    }
    return Math.round((count / totalItems) * 100);
  }, [checkedItems]);

  const value = useMemo<TabStateContextType>(() => ({
    checkedItems,
    completedSteps,
    masteredCards,
    quizResults,
    checkItem,
    uncheckItem,
    completeStep,
    uncompleteStep,
    masterCard,
    setQuizResult,
    isChecked,
    isStepCompleted,
    getCompletionPercent,
  }), [
    checkedItems, completedSteps, masteredCards, quizResults,
    checkItem, uncheckItem, completeStep, uncompleteStep,
    masterCard, setQuizResult, isChecked, isStepCompleted, getCompletionPercent,
  ]);

  return (
    <TabStateContext.Provider value={value}>
      {children}
    </TabStateContext.Provider>
  );
}

// ─── Hook ───

/**
 * Hook to access cross-tab item state.
 * Returns NOOP fallback when used outside TabStateProvider (safety for cached/shared pages).
 */
export function useTabState(): TabStateContextType {
  const ctx = useContext(TabStateContext);
  if (!ctx) return NOOP_CONTEXT;
  return ctx;
}
