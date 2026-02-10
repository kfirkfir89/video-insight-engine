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

  const headerLabel = block.filename
    ? block.filename
    : block.language
      ? block.language.toUpperCase()
      : 'Code';

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1 text-xs px-2 py-1 rounded transition-all duration-150',
        'hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        copied ? 'text-success code-copied-glow scale-110' : 'text-zinc-400'
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
  );

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="Code snippet"
      variant="code"
      headerIcon={<FileCode className="h-4 w-4" />}
      headerLabel={headerLabel}
      headerAction={copyButton}
    >
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
                        className={cn(isHighlighted && 'bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]')}
                      >
                        <td className="pr-4 text-right text-zinc-600 select-none tabular-nums">
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
    </BlockWrapper>
  );
});
