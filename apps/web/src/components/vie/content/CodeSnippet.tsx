import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';

interface CodeSnippetProps {
  code: string;
  /** Optional explanation text below the code */
  explanation?: string;
  className?: string;
}

/**
 * Domain-free code display with copy button.
 * Dark surface, monospace text. No @vie/types dependency.
 */
export const CodeSnippet = memo(function CodeSnippet({
  code,
  explanation,
  className,
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail
    }
  }, [code]);

  if (!code) return null;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg bg-code-bg text-code-text">
        <button
          onClick={handleCopy}
          className={cn(
            'absolute top-2 end-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
            copied
              ? 'text-success'
              : 'text-code-text-dim hover:text-code-text-bright',
          )}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
        <pre dir="ltr" className="overflow-x-auto p-3 pe-10 sm:p-4 sm:pe-16 text-sm leading-7">
          <code className="font-mono whitespace-pre-wrap" style={{ fontVariantLigatures: 'none' }}>{code}</code>
        </pre>
      </div>
      {explanation && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
      )}
    </div>
  );
});
