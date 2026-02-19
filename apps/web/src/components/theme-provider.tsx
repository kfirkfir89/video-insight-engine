import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ThemeContext, type Theme } from "./theme-context";

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

  useEffect(() => {
    let transitionTimer: ReturnType<typeof setTimeout>;

    // Initial theme is already applied by inline script in index.html
    const applyTheme = () => {
      const root = window.document.documentElement;

      // Enable smooth color transitions during theme switch (skip first mount)
      if (!isFirstRender.current) {
        root.classList.add("theme-transitioning");
      }

      root.classList.remove("light", "dark");
      root.classList.add(theme);

      // Remove after transition completes (matches 200ms in CSS)
      if (!isFirstRender.current) {
        transitionTimer = setTimeout(() => root.classList.remove("theme-transitioning"), 250);
      }
      isFirstRender.current = false;
    };

    // Defer if available, otherwise apply immediately
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(applyTheme, { timeout: 100 });
      return () => {
        window.cancelIdleCallback(id);
        clearTimeout(transitionTimer);
      };
    } else {
      applyTheme();
      return () => clearTimeout(transitionTimer);
    }
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
