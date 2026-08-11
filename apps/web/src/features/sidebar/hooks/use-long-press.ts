import { useRef, useCallback, useEffect } from "react";

const DEFAULT_LONG_PRESS_DELAY = 500; // milliseconds

interface UseLongPressOptions {
  /** Callback fired after long press is detected */
  onLongPress: () => void;
  /** Delay in milliseconds before long press triggers (default: 500ms) */
  delay?: number;
  /** Whether long press is disabled (e.g., when in selection mode) */
  disabled?: boolean;
}

interface UseLongPressReturn {
  /** Handler for pointer down event */
  onPointerDown: () => void;
  /** Handler for pointer up event */
  onPointerUp: () => void;
  /** Handler for pointer leave event */
  onPointerLeave: () => void;
}

/**
 * Hook for detecting long press gestures on touch/pointer devices.
 * Used for entering selection mode in sidebar items.
 *
 * @example
 * const longPress = useLongPress({
 *   onLongPress: () => enterSelectionMode(itemId),
 *   disabled: selectionMode,
 * });
 *
 * <div
 *   onPointerDown={longPress.onPointerDown}
 *   onPointerUp={longPress.onPointerUp}
 *   onPointerLeave={longPress.onPointerLeave}
 * >
 */
export function useLongPress({
  onLongPress,
  delay = DEFAULT_LONG_PRESS_DELAY,
  disabled = false,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(onLongPress, delay);
  }, [disabled, onLongPress, delay]);

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
