import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Concept } from '@vie/types';

const ConceptsContext = createContext<Concept[]>([]);

interface ConceptsProviderProps {
  concepts: Concept[];
  children: ReactNode;
}

/**
 * Scan container for concept buttons and mark first appearances via data attribute.
 * Scans in DOM order so the very first element with each concept-id gets marked.
 */
function markFirstAppearances(container: HTMLElement) {
  const seen = new Set<string>();
  const els = container.querySelectorAll<HTMLElement>('[data-concept-id]');
  for (const el of els) {
    const id = el.dataset.conceptId!;
    if (!seen.has(id)) {
      seen.add(id);
      el.dataset.firstAppearance = 'true';
    } else {
      delete el.dataset.firstAppearance;
    }
  }
}

/**
 * Provides concepts via React context for ConceptHighlighter to consume.
 * Does NOT handle first-appearance DOM scanning — use GlobalConceptScanner for that.
 */
export function ConceptsProvider({ concepts, children }: ConceptsProviderProps) {
  return (
    <ConceptsContext.Provider value={concepts}>
      {children}
    </ConceptsContext.Provider>
  );
}

/**
 * Wraps all chapters and scans the entire subtree for first-appearance marking.
 * Must be a parent of all ConceptsProvider instances so that DOM-order scanning
 * correctly identifies the globally-first occurrence of each concept.
 */
export function GlobalConceptScanner({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    markFirstAppearances(container);

    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (containerRef.current) markFirstAppearances(containerRef.current);
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      const marked = container.querySelectorAll<HTMLElement>('[data-first-appearance]');
      for (const el of marked) {
        delete el.dataset.firstAppearance;
      }
    };
  }, []);

  return <div ref={containerRef}>{children}</div>;
}

export function useConcepts(): Concept[] {
  return useContext(ConceptsContext);
}
