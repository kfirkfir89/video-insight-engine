import { createContext, useContext, useMemo } from 'react';

interface DirectionContextValue {
  /** Text direction: 'ltr' or 'rtl'. */
  direction: 'ltr' | 'rtl';
  /** Whether the content language is right-to-left. */
  isRTL: boolean;
  /** ISO 639-1 language code. */
  language: string;
}

const DirectionContext = createContext<DirectionContextValue>({
  direction: 'ltr',
  isRTL: false,
  language: 'en',
});

interface DirectionProviderProps {
  /** ISO 639-1 language code (e.g., "en", "he", "ar"). */
  language?: string;
  /** Whether the language is RTL. */
  isRTL?: boolean;
  children: React.ReactNode;
}

/**
 * Provides text direction context for video output content.
 * Wraps only the video output area — NOT the app shell (sidebar stays LTR).
 */
export function DirectionProvider({
  language = 'en',
  isRTL = false,
  children,
}: DirectionProviderProps) {
  const value = useMemo<DirectionContextValue>(
    () => ({
      direction: isRTL ? 'rtl' : 'ltr',
      isRTL,
      language,
    }),
    [isRTL, language],
  );

  return (
    <DirectionContext.Provider value={value}>
      <div dir={isRTL ? 'rtl' : undefined}>{children}</div>
    </DirectionContext.Provider>
  );
}

/**
 * Hook to access text direction context.
 * Returns { direction, isRTL, language }.
 */
export function useDirection(): DirectionContextValue {
  return useContext(DirectionContext);
}
