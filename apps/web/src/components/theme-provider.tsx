// TODO: v1.5 Phase 3 — Call PATCH /api/users/me/preferences on theme change (debounce 1s, auth required)
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ThemeContext, resolveTheme, type Theme } from "./theme-context";

interface ViewTransition {
  skipTransition(): void;
  finished: Promise<void>;
}

/** Run a DOM mutation inside a View Transition when supported, falling back to direct invocation. */
function runViewTransition(
  apply: () => void,
  activeTransition: React.RefObject<ViewTransition | null>,
) {
  const svt = (
    document as { startViewTransition?: (cb: () => void) => ViewTransition }
  ).startViewTransition;
  if (svt && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (activeTransition.current) activeTransition.current.skipTransition();
    const transition = svt.call(document, apply);
    activeTransition.current = transition;
    transition.finished.catch((err) => {
      if (err?.name !== "AbortError") console.warn("View transition failed:", err);
    });
  } else {
    apply();
  }
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
    if (stored === "dark" || stored === "light" || stored === "system")
      return stored;
    return defaultTheme;
  });
  const skipTransitionOnMount = useRef(true);
  const activeTransition = useRef<ViewTransition | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      root.dataset.theme = resolveTheme(theme);
    };

    // Skip View Transition on first mount, use it for subsequent changes
    if (skipTransitionOnMount.current) {
      applyTheme();
    } else {
      runViewTransition(applyTheme, activeTransition);
    }

    skipTransitionOnMount.current = false;

    // Listen for OS theme changes when in system mode
    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const resolved = mql.matches ? "dark" : "light";
        runViewTransition(() => { root.dataset.theme = resolved; }, activeTransition);
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  const handleSetTheme = useCallback(
    (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    [storageKey]
  );

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
