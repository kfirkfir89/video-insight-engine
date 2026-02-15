import { createHighlighter, type Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

const PRELOAD_LANGS = ['javascript', 'typescript', 'python', 'bash', 'json', 'html', 'css'] as const;
const THEME_LIGHT = 'github-light';
const THEME_DARK = 'github-dark';

/**
 * Returns a singleton Shiki highlighter instance.
 * Pre-loads common languages and both light/dark themes.
 */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME_LIGHT, THEME_DARK],
      langs: [...PRELOAD_LANGS],
    });
  }
  return highlighterPromise;
}

/**
 * Highlights code with Shiki and returns HTML string.
 * Falls back gracefully if the language isn't supported.
 */
export async function highlightCode(
  code: string,
  language: string,
  theme: 'dark' | 'light'
): Promise<string> {
  const highlighter = await getHighlighter();
  const loadedLangs = highlighter.getLoadedLanguages();
  const lang = language.toLowerCase();

  // Load language on-demand if not pre-loaded
  if (!loadedLangs.includes(lang)) {
    try {
      await highlighter.loadLanguage(lang as Parameters<Highlighter['loadLanguage']>[0]);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[Shiki] Unsupported language: ${lang}`, err);
      }
      return '';
    }
  }

  return highlighter.codeToHtml(code, {
    lang,
    theme: theme === 'dark' ? THEME_DARK : THEME_LIGHT,
  });
}
