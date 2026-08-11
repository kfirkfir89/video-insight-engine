import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeSnippetProps {
  code: string;
  explanation?: string;
  className?: string;
}

/**
 * Code display with copy button. Icon swap via layered opacity/scale
 * transitions — no motion runtime.
 */
export const CodeSnippet = memo(function CodeSnippet({
  code,
  explanation,
  className,
}: CodeSnippetProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — silently skip */
    }
  }, [code]);

  if (!code) return null;

  return (
    <div className={cn('animate-fade-up', className)}>
      <div className="group relative overflow-hidden rounded-xl bg-code-bg text-code-text border border-[var(--code-border)] shadow-[0_8px_24px_-12px_oklch(0%_0_0_/_0.5)]">
        <button
          onClick={handleCopy}
          className={cn(
            'absolute top-2 end-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors active:scale-95 duration-150',
            copied ? 'text-success' : 'text-code-text-dim hover:text-code-text-bright',
          )}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          <span className="relative inline-block h-3 w-3" aria-hidden="true">
            <Copy
              className={cn(
                'absolute inset-0 h-3 w-3 transition-all duration-200 ease-[var(--ease-out-expo)]',
                copied ? 'opacity-0 scale-50' : 'opacity-100 scale-100',
              )}
            />
            <Check
              className={cn(
                'absolute inset-0 h-3 w-3 transition-all duration-300 ease-[var(--ease-out-expo)]',
                copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50 -rotate-45',
              )}
            />
          </span>
        </button>
        <pre dir="ltr" className="overflow-x-auto p-3 pe-10 sm:p-4 sm:pe-16 text-sm leading-7">
          <code className="font-mono whitespace-pre-wrap" style={{ fontVariantLigatures: 'none' }}>
            {code}
          </code>
        </pre>
      </div>
      {explanation && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
      )}
    </div>
  );
});
