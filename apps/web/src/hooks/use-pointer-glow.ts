import { useCallback, useRef, type PointerEvent } from 'react';

interface PointerGlowOptions {
  /** CSS variable prefix — becomes `--{prefix}-x`, `--{prefix}-y`, `--{prefix}-on`. Default "glow". */
  prefix?: string;
}

interface PointerGlowHandlers {
  ref: (node: HTMLElement | null) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * Writes pointer position as CSS variables on the target element,
 * enabling a cursor-tracked radial glow or sheen without React re-renders.
 *
 * CSS variables set:
 *   --{prefix}-x   (0–100 % along width)
 *   --{prefix}-y   (0–100 % along height)
 *   --{prefix}-on  (0 or 1 — for opacity ramping)
 */
export function usePointerGlow({ prefix = 'glow' }: PointerGlowOptions = {}): PointerGlowHandlers {
  const elRef = useRef<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null): void => {
    elRef.current = node;
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>): void => {
      const el = elRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty(`--${prefix}-x`, `${x}%`);
      el.style.setProperty(`--${prefix}-y`, `${y}%`);
    },
    [prefix],
  );

  const onPointerEnter = useCallback((): void => {
    elRef.current?.style.setProperty(`--${prefix}-on`, '1');
  }, [prefix]);

  const onPointerLeave = useCallback((): void => {
    elRef.current?.style.setProperty(`--${prefix}-on`, '0');
  }, [prefix]);

  return { ref, onPointerMove, onPointerEnter, onPointerLeave };
}
