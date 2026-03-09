import { memo, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CodeBlock as CodeBlockType, TerminalBlock as TerminalBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

type CodeBlockProps =
  | { block: CodeBlockType }
  | { block: TerminalBlockType }
  | { title?: string; code: string; explanation?: string };

function getCodeContent(props: CodeBlockProps): { text: string; explanation?: string } {
  if ('code' in props && typeof props.code === 'string') {
    return { text: props.code, explanation: props.explanation };
  }
  const block = (props as { block: CodeBlockType | TerminalBlockType }).block;
  if (block.type === 'terminal') {
    const parts = [block.command];
    if (block.output) parts.push(block.output);
    return { text: parts.join('\n') };
  }
  return { text: block.code };
}

function getCopyText(props: CodeBlockProps): string {
  if ('code' in props && typeof props.code === 'string') return props.code;
  const block = (props as { block: CodeBlockType | TerminalBlockType }).block;
  if (block.type === 'terminal') return block.command;
  return block.code;
}

/**
 * Unified code display block.
 * Handles code, example, and terminal types.
 * Minimal: dark surface, monospace text, copy button. No header chrome.
 */
export const CodeBlock = memo(function CodeBlock(props: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyText = getCopyText(props);
  const { text, explanation } = getCodeContent(props);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS or restricted contexts
    }
  }, [copyText]);

  if (!text) return null;

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-[oklch(12%_0_0)] text-[oklch(90%_0_0)]">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            'absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
            copied
              ? 'text-success'
              : 'text-[oklch(50%_0_0)] hover:text-[oklch(75%_0_0)]'
          )}
          aria-label={copied ? BLOCK_LABELS.copied : BLOCK_LABELS.copyCode}
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
        </button>

        {/* Code content */}
        <pre className="overflow-x-auto p-4 pr-16 text-sm leading-relaxed">
          <code className="font-mono whitespace-pre-wrap">{text}</code>
        </pre>
      </div>

      {/* Explanation (example blocks) */}
      {explanation && (
        <p className="mt-2 text-sm text-muted-foreground">
          {explanation}
        </p>
      )}
    </div>
  );
});
