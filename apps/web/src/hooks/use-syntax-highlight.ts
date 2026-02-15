import { useState, useEffect, useSyncExternalStore } from 'react';
import { highlightCode } from '@/lib/syntax-highlighter';
import { useTheme } from '@/hooks/use-theme';

interface UseSyntaxHighlightResult {
  html: string | null;
  isLoading: boolean;
}

/** Subscribe to OS color-scheme changes for reactive system theme detection. */
function subscribeToMediaQuery(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSystemThemeSnapshot(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * React hook that returns Shiki-highlighted HTML for a code snippet.
 * Returns null while loading, allowing components to show a fallback.
 */
export function useSyntaxHighlight(
  code: string,
  language: string | undefined
): UseSyntaxHighlightResult {
  const { theme } = useTheme();
  const systemTheme = useSyncExternalStore(subscribeToMediaQuery, getSystemThemeSnapshot);
  const [html, setHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    if (!language || !code) {
      setHtml(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    highlightCode(code, language, effectiveTheme as 'dark' | 'light')
      .then((result) => {
        if (!cancelled) {
          setHtml(result || null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, language, effectiveTheme]);

  return { html, isLoading };
}
