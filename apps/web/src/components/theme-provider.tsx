import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ThemeContext, type Theme } from "./theme-context";

interface ViewTransition {
  skipTransition(): void;
  finished: Promise<void>;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "vie-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey);
    // Migrate: treat "system" or invalid values as default
    if (stored === "dark" || stored === "light") return stored;
    return defaultTheme;
  });
  const isFirstRender = useRef(true);
  const activeTransition = useRef<ViewTransition | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;

    const updateDOM = () => {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    };

    // Use View Transitions API for GPU-accelerated crossfade (skip first mount)
    const startViewTransition = (document as { startViewTransition?: (cb: () => void) => ViewTransition }).startViewTransition;
    if (
      !isFirstRender.current &&
      startViewTransition &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Cancel any in-flight transition to prevent competing animations
      if (activeTransition.current) {
        activeTransition.current.skipTransition();
      }
      const transition = startViewTransition.call(document, updateDOM);
      activeTransition.current = transition;
      // Prevent unhandled rejection if transition is aborted/cancelled
      transition.finished.catch(() => {});
    } else {
      updateDOM();
    }

    isFirstRender.current = false;
  }, [theme]);

  // Memoize setTheme callback to prevent context value recreation
  const handleSetTheme = useCallback(
    (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    [storageKey]
  );

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      theme,
      setTheme: handleSetTheme,
    }),
    [theme, handleSetTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
