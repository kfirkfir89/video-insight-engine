import { useMemo, type CSSProperties } from "react";

/**
 * Cache for folder color styles to avoid creating new objects.
 * Key is the color value, value is the style object.
 */
const folderColorStyleCache = new Map<string | null | undefined, CSSProperties | undefined>();

/**
 * Get a cached style object for folder icon color.
 * Returns the same object reference for the same color to prevent unnecessary re-renders.
 */
export function getFolderColorStyle(
  color: string | null | undefined
): CSSProperties | undefined {
  if (!color) return undefined;

  let style = folderColorStyleCache.get(color);
  if (!style) {
    style = { color };
    folderColorStyleCache.set(color, style);
  }
  return style;
}

/**
 * Hook to get memoized folder color style.
 * Use this in components where you need a stable style reference.
 */
export function useFolderColorStyle(
  color: string | null | undefined
): CSSProperties | undefined {
  return useMemo(
    () => (color ? { color } : undefined),
    [color]
  );
}
