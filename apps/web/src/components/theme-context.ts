import { createContext } from "react";

export type Theme = "dark" | "light" | "system" | "lagoon";

/** The concrete theme written to `data-theme` ("system" always resolves away). */
export type ResolvedTheme = "dark" | "light" | "lagoon";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Resolve "system" to dark/light via OS preference; explicit themes pass through. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}
