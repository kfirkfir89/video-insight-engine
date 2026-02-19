/**
 * Walk up the DOM to find the nearest scrollable ancestor.
 * Checks computed `overflowY` for "auto" or "scroll".
 * Falls back to `document.documentElement` if no scrollable ancestor is found.
 */
export function findScrollParent(element: Element): HTMLElement {
  let parent = element.parentElement;
  while (parent) {
    const overflow = window.getComputedStyle(parent).overflowY;
    if (overflow === "auto" || overflow === "scroll") return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}
