import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';

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
    const terminalCopyButton = (
      <button
        onClick={handleCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        className={cn(
          'flex items-center gap-1 text-xs ml-3 shrink-0 transition-colors',
          copied ? 'text-success code-copied-glow' : 'text-zinc-500 hover:text-zinc-300'
        )}
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
        {copied ? 'Copied!' : 'Copy'}
      </button>
    );

    return (
      <BlockWrapper
        label="Terminal command"
        variant="code"
        headerIcon={<Terminal className="h-4 w-4" />}
        headerLabel="Terminal"
        headerAction={terminalCopyButton}
      >
        <div className="p-3">
          <pre className="text-sm overflow-x-auto">
            <code className="font-mono text-zinc-100">
              <span className="text-success code-prompt-glow mr-2">$</span>
              {code}
            </code>
          </pre>
          {explanation && (
            <p className="mt-2 text-xs text-zinc-500"><ConceptHighlighter text={explanation} /></p>
          )}
        </div>
      </BlockWrapper>
    );
  }

  // Default code example
  return (
    <BlockWrapper
      label="Code example"
      variant="transparent"
    >
      <div className="block-code-container overflow-hidden">
        {/* Header bar with title and copy */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/30">
          <span className="text-xs text-muted-foreground font-medium">{title || 'Example'}</span>
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
            className={cn(
              'flex items-center gap-1 text-xs transition-colors',
              copied ? 'text-success code-copied-glow' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Code area */}
        <div className="px-4 py-3">
          <pre className="text-sm overflow-x-auto">
            <code className="font-mono">{code}</code>
          </pre>
        </div>
      </div>
      {/* Explanation footer */}
      {explanation && (
        <div className="px-1 py-2">
          <p className="text-sm text-muted-foreground"><ConceptHighlighter text={explanation} /></p>
        </div>
      )}
    </BlockWrapper>
  );
});
