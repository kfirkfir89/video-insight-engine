import { useState, useEffect } from 'react';
import { highlightCode } from '@/lib/syntax-highlighter';
import { useTheme } from '@/hooks/use-theme';
import { resolveTheme } from '@/components/theme-context';

interface UseSyntaxHighlightResult {
  html: string | null;
  isLoading: boolean;
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
  const [html, setHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!language || !code) {
      setHtml(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const resolvedTheme = resolveTheme(theme);

    highlightCode(code, language, resolvedTheme)
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
  }, [code, language, theme]);

  return { html, isLoading };
}
