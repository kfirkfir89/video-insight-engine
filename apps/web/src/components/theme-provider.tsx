import { useEffect, useState, useMemo, useCallback } from "react";
import { ThemeContext, type Theme } from "./theme-context";

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vie-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    // Use requestIdleCallback for non-critical theme sync
    // Initial theme is already applied by inline script in index.html
    const applyTheme = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    };

    // Defer if available, otherwise apply immediately
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(applyTheme, { timeout: 100 });
      return () => window.cancelIdleCallback(id);
    } else {
      applyTheme();
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
