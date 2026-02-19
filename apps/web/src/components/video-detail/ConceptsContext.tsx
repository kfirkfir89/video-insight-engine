import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Concept } from '@vie/types';

const ConceptsContext = createContext<Concept[]>([]);

/**
 * Shared data-slot value for article sections.
 * Used by ArticleSection (sets it) and concept scanning (queries it).
 */
export const ARTICLE_SECTION_SLOT = "article-section";
const ARTICLE_SECTION_SELECTOR = `article[data-slot="${ARTICLE_SECTION_SLOT}"]`;

interface ConceptsProviderProps {
  concepts: Concept[];
  children: ReactNode;
}

/**
 * Scan container for concept buttons and mark first appearances via data attribute.
 * Scans in DOM order so the very first element with each concept-id gets marked.
 * Scopes dedup per-chapter using ARTICLE_SECTION_SELECTOR.
 */
function markFirstAppearances(container: HTMLElement) {
  const globalSeen = new Set<string>();
  const articles = container.querySelectorAll<HTMLElement>(ARTICLE_SECTION_SELECTOR);

  for (const article of articles) {
    const chapterSeen = new Set<string>();
    const els = article.querySelectorAll<HTMLElement>('[data-concept-id]');

    for (const el of els) {
      const id = el.dataset.conceptId;
      if (!id) continue;

      if (chapterSeen.has(id)) {
        el.dataset.chapterDuplicate = 'true';
        delete el.dataset.firstAppearance;
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-hidden', 'true');
      } else {
        chapterSeen.add(id);
        delete el.dataset.chapterDuplicate;
        el.removeAttribute('aria-hidden');

        if (!globalSeen.has(id)) {
          globalSeen.add(id);
          el.dataset.firstAppearance = 'true';
        } else {
          delete el.dataset.firstAppearance;
        }
      }
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

    let rafId = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) markFirstAppearances(containerRef.current);
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    observerRef.current = observer;

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      const marked = container.querySelectorAll<HTMLElement>('[data-first-appearance], [data-chapter-duplicate]');
      for (const el of marked) {
        delete el.dataset.firstAppearance;
        delete el.dataset.chapterDuplicate;
        el.removeAttribute('tabindex');
        el.removeAttribute('aria-hidden');
      }
    };
  }, []);

  return <div ref={containerRef}>{children}</div>;
}

export function useConcepts(): Concept[] {
  return useContext(ConceptsContext);
}
