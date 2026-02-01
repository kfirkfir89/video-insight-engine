import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Code2, Copy } from 'lucide-react';

interface ExampleBlockProps {
  title?: string;
  code: string;
  explanation?: string;
  variant?: string;
}

/**
 * Renders a code example block with copy functionality.
 * Variants:
 * - terminal_command: Minimal single-panel design with $ prompt
 */
export const ExampleBlock = memo(function ExampleBlock({ title, code, explanation, variant }: ExampleBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard API may fail in certain contexts (non-HTTPS, iframe restrictions)
      // Fail silently - user can still manually copy
      if (import.meta.env.DEV) {
        console.warn('Failed to copy to clipboard:', err);
      }
    }
  }, [code]);

  // Terminal command variant: ultra-minimal
  if (variant === 'terminal_command') {
    return (
      <div className="rounded-lg bg-zinc-950 dark:bg-black p-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <pre className="text-sm overflow-x-auto">
            <code className="font-mono text-emerald-400">
              <span className="text-emerald-500/70 mr-2">$</span>
              {code}
            </code>
          </pre>
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 ml-3 shrink-0"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {explanation && (
          <p className="mt-2 text-xs text-zinc-500">{explanation}</p>
        )}
      </div>
    );
  }

  // Default code example
  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">
            {title || 'Example'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code area */}
      <div className="bg-zinc-950 dark:bg-zinc-900 px-4 py-3">
        <pre className="text-sm overflow-x-auto">
          <code className="font-mono text-zinc-300">{code}</code>
        </pre>
      </div>
      {/* Explanation footer */}
      {explanation && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground">{explanation}</p>
        </div>
      )}
    </div>
  );
});
