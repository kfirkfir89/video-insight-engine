import { memo, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { TerminalBlock as TerminalBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface TerminalBlockProps {
  block: TerminalBlockType;
}

/**
 * Renders a terminal command with optional output.
 */
export const TerminalBlock = memo(function TerminalBlock({ block }: TerminalBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(block.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS or restricted contexts
    }
  }, [block.command]);

  if (!block.command) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="Terminal command"
    >
      <div className="rounded-lg border border-border/50 overflow-hidden bg-zinc-900 dark:bg-zinc-950">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-zinc-400 ml-2">{BLOCK_LABELS.terminal}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
              'hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              copied ? 'text-emerald-400' : 'text-zinc-400'
            )}
            aria-label={copied ? BLOCK_LABELS.copied : BLOCK_LABELS.copyCode}
          >
            {copied ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Command */}
        <div className="p-4 font-mono text-sm">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 select-none">$</span>
            <span className="text-zinc-100 whitespace-pre-wrap">{block.command}</span>
          </div>

          {/* Output */}
          {block.output && (
            <div className="mt-3 pt-3 border-t border-zinc-700/50">
              <div className="text-xs text-zinc-500 mb-1">{BLOCK_LABELS.output}:</div>
              <pre className="text-zinc-400 whitespace-pre-wrap text-xs">{block.output}</pre>
            </div>
          )}
        </div>
      </div>
    </BlockWrapper>
  );
});
