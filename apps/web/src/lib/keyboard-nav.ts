import type { KeyboardEvent } from "react";

/**
 * Keyboard handler for WAI-ARIA vertical tablist navigation.
 * Handles ArrowUp, ArrowDown, Home, End with focus management.
 *
 * @param e - The keyboard event from the tab element
 * @param index - Current tab index (0-based)
 * @param count - Total number of tabs
 */
export function handleVerticalTablistKeyDown(
  e: KeyboardEvent<HTMLElement>,
  index: number,
  count: number,
): void {
  let targetIndex: number | null = null;

  if (e.key === "ArrowDown") {
    targetIndex = (index + 1) % count;
  } else if (e.key === "ArrowUp") {
    targetIndex = (index - 1 + count) % count;
  } else if (e.key === "Home") {
    targetIndex = 0;
  } else if (e.key === "End") {
    targetIndex = count - 1;
  }

  if (targetIndex !== null) {
    e.preventDefault();
    const tabs =
      e.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[role="tab"]',
      );
    tabs?.[targetIndex]?.focus();
  }
}
