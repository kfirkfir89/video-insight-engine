import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Concept } from '@vie/types';

const ConceptsContext = createContext<Concept[]>([]);

interface ConceptsProviderProps {
  concepts: Concept[];
  children: ReactNode;
}

/**
 * Scan container for concept buttons and mark first appearances via data attribute.
 * Uses MutationObserver to handle async/streamed content rendering.
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

export function ConceptsProvider({ concepts, children }: ConceptsProviderProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Callback ref: attaches to the sentinel span, then walks up to its parent
  // so we observe the real content container without adding an extra wrapper div.
  const sentinelRef = useCallback((node: HTMLSpanElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) {
      containerRef.current = null;
      return;
    }

    // Use the sentinel's parent as the observation target
    const container = node.parentElement;
    if (!container) return;
    containerRef.current = container;

    markFirstAppearances(container);

    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        markFirstAppearances(container);
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    observerRef.current = observer;
  }, []);

  // Re-scan when concepts change (the callback ref only fires on mount/unmount)
  useEffect(() => {
    const container = containerRef.current;
    if (container) markFirstAppearances(container);
  }, [concepts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      const container = containerRef.current;
      if (container) {
        const marked = container.querySelectorAll<HTMLElement>('[data-first-appearance]');
        for (const el of marked) {
          delete el.dataset.firstAppearance;
        }
      }
    };
  }, []);

  return (
    <ConceptsContext.Provider value={concepts}>
      <span ref={sentinelRef} style={{ display: 'none' }} aria-hidden="true" />
      {children}
    </ConceptsContext.Provider>
  );
}

export function useConcepts(): Concept[] {
  return useContext(ConceptsContext);
}
