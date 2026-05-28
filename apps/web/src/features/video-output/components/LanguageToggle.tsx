import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useLabels } from '@/lib/i18n';

interface LanguageToggleProps {
  /** True when the source-language nested view is active; false = English (primary). */
  showOriginal: boolean;
  onChange: (next: boolean) => void;
  /** Native-script display name from the backend's `sourceLanguage.name`,
   *  e.g. "עברית", "中文", "Español". */
  originalName: string;
  /** ISO 639-1 code from the backend's `sourceLanguage.code`. Applied as the
   *  `lang` attribute on the original-language pill so screen readers pick
   *  the right voice. Tolerates null/empty payloads — falls back to "und"
   *  (ISO 639-3 "undetermined") rather than crashing the page. */
  originalCode: string;
  className?: string;
}

// Use ISO 639-3 "und" (undetermined) when the backend hasn't given us a code.
// This keeps the `lang` attribute valid for assistive tech instead of
// throwing on a missing/null code.
function safeLang(code: string | null | undefined): string {
  if (!code) return 'und';
  return code.toLowerCase();
}

/**
 * Two-option language switcher. Uses the WAI-ARIA radiogroup pattern with a
 * roving tabindex so arrow keys move selection between English and the
 * source language — the correct semantic for mutually exclusive options.
 * `aria-checked` (not `aria-pressed`) is what announces selection state to
 * screen readers in this pattern.
 */
export function LanguageToggle({
  showOriginal,
  onChange,
  originalName,
  originalCode,
  className,
}: LanguageToggleProps) {
  const labels = useLabels();
  const englishRef = useRef<HTMLButtonElement>(null);
  const originalRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Roving-tabindex movement: Left/Up moves to previous option,
      // Right/Down moves to next, Home/End jump to first/last. Selection
      // follows focus so screen readers announce the new state immediately
      // — matches the native <input type="radio"> behaviour users expect.
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          onChange(false);
          englishRef.current?.focus();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          onChange(true);
          originalRef.current?.focus();
          break;
        case 'Home':
          e.preventDefault();
          onChange(false);
          englishRef.current?.focus();
          break;
        case 'End':
          e.preventDefault();
          onChange(true);
          originalRef.current?.focus();
          break;
      }
    },
    [onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label={labels.contentLanguage}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center rounded-full border border-border/60 bg-card/60 p-0.5 text-sm shadow-xs backdrop-blur-sm',
        className,
      )}
    >
      <Pill
        ref={englishRef}
        active={!showOriginal}
        onClick={() => onChange(false)}
        lang="en"
      >
        English
      </Pill>
      <Pill
        ref={originalRef}
        active={showOriginal}
        onClick={() => onChange(true)}
        lang={safeLang(originalCode)}
      >
        {originalName}
      </Pill>
    </div>
  );
}

interface PillProps {
  active: boolean;
  onClick: () => void;
  lang: string;
  children: React.ReactNode;
  ref: React.Ref<HTMLButtonElement>;
}

function Pill({ active, onClick, lang, children, ref }: PillProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      // Roving-tabindex: only the selected option is in the tab order. Arrow
      // keys move focus between options without leaving the group.
      tabIndex={active ? 0 : -1}
      aria-checked={active}
      onClick={onClick}
      lang={lang}
      className={cn(
        'rounded-full px-3 py-1 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
