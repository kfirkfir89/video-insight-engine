import { memo, useState, useCallback } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { CodeBlock as CodeBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface CodeBlockProps {
  block: CodeBlockType;
}

/**
 * Renders syntax-highlighted code with copy functionality.
 * Uses basic highlighting - can be enhanced with Shiki/Prism for full syntax highlighting.
 */
export const CodeBlock = memo(function CodeBlock({ block }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS or restricted contexts
    }
  }, [block.code]);

  if (!block.code) return null;

  const lines = block.code.split('\n');
  const showLineNumbers = lines.length > 1;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="Code snippet"
    >
      <div className="rounded-lg border border-border/50 overflow-hidden bg-muted/30">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
            {block.filename && <span className="font-mono">{block.filename}</span>}
            {!block.filename && block.language && (
              <span className="uppercase tracking-wide">{block.language}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
              'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
            )}
            aria-label={copied ? BLOCK_LABELS.copied : BLOCK_LABELS.copyCode}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" aria-hidden="true" />
                <span>{BLOCK_LABELS.copied}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" aria-hidden="true" />
                <span>{BLOCK_LABELS.copyCode}</span>
              </>
            )}
          </button>
        </div>

        {/* Code content */}
        <div className="overflow-x-auto">
          <pre className="p-4 text-sm">
            <code className="font-mono">
              {showLineNumbers ? (
                <table className="border-collapse">
                  <tbody>
                    {lines.map((line, index) => {
                      const lineNum = index + 1;
                      const isHighlighted = block.highlightLines?.includes(lineNum);
                      return (
                        <tr
                          key={index}
                          className={cn(isHighlighted && 'bg-primary/10')}
                        >
                          <td className="pr-4 text-right text-muted-foreground/40 select-none tabular-nums">
                            {lineNum}
                          </td>
                          <td className="whitespace-pre">{line || ' '}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <span className="whitespace-pre-wrap">{block.code}</span>
              )}
            </code>
          </pre>
        </div>
      </div>
    </BlockWrapper>
  );
});
