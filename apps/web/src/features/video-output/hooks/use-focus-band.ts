import { useCallback, useEffect, useRef } from 'react';

export interface UseFocusBandOptions {
  /** Master switch — false tears down the observer and clears any focus mark. */
  enabled: boolean;
  /** Number of tracked rows. Bands under 3 rows read as noise, so no observer. */
  count: number;
}

export interface UseFocusBandResult {
  /** Ref-callback registrar — attach per row: `ref={(el) => setRef(index, el)}`. */
  setRef: (index: number, el: HTMLElement | null) => void;
}

interface FocusCandidate {
  ratio: number;
  /** Distance from the element center to the band center — tie-breaker. */
  centerDistance: number;
}

/** Band occupies the 32%–54% viewport strip (reading zone below the fold line). */
const BAND_ROOT_MARGIN = '-32% 0px -46% 0px';
const BAND_THRESHOLDS = [0, 0.5, 1];
/** A challenger must beat the incumbent's ratio by this margin to steal focus. */
const HYSTERESIS = 0.15;
/** Ratios closer than this are considered tied → center distance decides. */
const RATIO_EPSILON = 1e-6;
const MIN_COUNT = 3;

/**
 * Generic scroll "focus band": marks the row currently crossing a horizontal
 * viewport band with `data-focus="true"` — imperatively, no React state, so a
 * 60fps scroll never re-renders the list. One IntersectionObserver for all
 * rows; entries are rAF-batched and resolved with hysteresis so focus doesn't
 * flicker between adjacent rows.
 *
 * With `enabled: false` or fewer than 3 rows, no observer is created and any
 * existing mark is cleared — the default render is complete without it.
 */
export function useFocusBand({ enabled, count }: UseFocusBandOptions): UseFocusBandResult {
  const elementsRef = useRef(new Map<number, HTMLElement>());
  const candidatesRef = useRef(new Map<HTMLElement, FocusCandidate>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const focusedRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const active = enabled && count >= MIN_COUNT;

  const applyFocus = useCallback((el: HTMLElement | null): void => {
    const prev = focusedRef.current;
    if (prev === el) return;
    if (prev) delete prev.dataset.focus;
    if (el) el.dataset.focus = 'true';
    focusedRef.current = el;
  }, []);

  const resolveFocus = useCallback((): void => {
    rafRef.current = null;
    let best: HTMLElement | null = null;
    let bestCandidate: FocusCandidate | null = null;
    for (const [el, candidate] of candidatesRef.current) {
      if (
        bestCandidate === null ||
        candidate.ratio > bestCandidate.ratio + RATIO_EPSILON ||
        (Math.abs(candidate.ratio - bestCandidate.ratio) <= RATIO_EPSILON &&
          candidate.centerDistance < bestCandidate.centerDistance)
      ) {
        best = el;
        bestCandidate = candidate;
      }
    }
    if (!best || !bestCandidate) return;

    const incumbent = focusedRef.current;
    if (incumbent === best) return;
    const incumbentRatio = incumbent ? (candidatesRef.current.get(incumbent)?.ratio ?? 0) : 0;

    if (bestCandidate.ratio <= 0) {
      // Nothing is in the band. Clear only when the incumbent has fully left
      // too — otherwise keep the last focused row marked to avoid dead zones.
      if (incumbentRatio <= 0) applyFocus(null);
      return;
    }
    if (!incumbent || bestCandidate.ratio > incumbentRatio + HYSTERESIS) {
      applyFocus(best);
    }
  }, [applyFocus]);

  const handleEntries = useCallback(
    (entries: IntersectionObserverEntry[]): void => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const rect = entry.boundingClientRect;
        const root = entry.rootBounds;
        const centerDistance = root
          ? Math.abs(rect.top + rect.height / 2 - (root.top + root.height / 2))
          : 0;
        candidatesRef.current.set(el, { ratio: entry.intersectionRatio, centerDistance });
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(resolveFocus);
      }
    },
    [resolveFocus],
  );

  const setRef = useCallback(
    (index: number, el: HTMLElement | null): void => {
      const prev = elementsRef.current.get(index);
      if (prev === el) return;
      if (prev) {
        observerRef.current?.unobserve(prev);
        candidatesRef.current.delete(prev);
        if (focusedRef.current === prev) applyFocus(null);
        elementsRef.current.delete(index);
      }
      if (el) {
        elementsRef.current.set(index, el);
        observerRef.current?.observe(el);
      }
    },
    [applyFocus],
  );

  useEffect(() => {
    if (!active) return;
    const observer = new IntersectionObserver(handleEntries, {
      rootMargin: BAND_ROOT_MARGIN,
      threshold: BAND_THRESHOLDS,
    });
    observerRef.current = observer;
    for (const el of elementsRef.current.values()) observer.observe(el);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      observer.disconnect();
      observerRef.current = null;
      candidatesRef.current.clear();
      applyFocus(null);
    };
  }, [active, handleEntries, applyFocus]);

  return { setRef };
}
