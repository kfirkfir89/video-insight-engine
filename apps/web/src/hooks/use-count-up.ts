import { useEffect, useRef, useState } from 'react';

interface CountUpOptions {
  /** Total animation duration in ms. Default 900. */
  duration?: number;
  /** Fires after value reaches target. */
  onComplete?: () => void;
  /** When false, value jumps immediately. */
  enabled?: boolean;
}

/**
 * Animates a number from 0 to `target` with an ease-out curve.
 * Returns the current interpolated value.
 *
 * Resets and re-animates whenever `target` changes. `onComplete` is read via
 * a ref so a fresh inline arrow from the caller doesn't restart the animation
 * every render.
 */
export function useCountUp(target: number, options: CountUpOptions = {}): number {
  const { duration = 900, onComplete, enabled = true } = options;

  // Initialize to target when reduced-motion is on (or disabled) so the first
  // paint shows the final value instead of a 0-flash before the rAF tick.
  const [value, setValue] = useState<number>(() => {
    if (!enabled) return target;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return target;
    }
    return 0;
  });

  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || target === 0) {
      setValue(target);
      onCompleteRef.current?.();
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(target);
        onCompleteRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}
