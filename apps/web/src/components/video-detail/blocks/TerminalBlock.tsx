import { memo, useState, useCallback } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
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

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
        'hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        copied ? 'text-success code-copied-glow' : 'text-zinc-400'
      )}
      aria-label={copied ? BLOCK_LABELS.copied : BLOCK_LABELS.copyCode}
    >
      {copied ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="Terminal command"
      variant="code"
      headerIcon={<Terminal className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.terminal}
      headerAction={copyButton}
    >
      {/* Command */}
      <div className="p-4 font-mono text-sm">
        <div className="flex items-start gap-2">
          <span className="text-success code-prompt-glow select-none">$</span>
          <span className="text-zinc-100 whitespace-pre-wrap"><ConceptHighlighter text={block.command} /></span>
        </div>

        {/* Output */}
        {block.output && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs text-zinc-500 mb-1">{BLOCK_LABELS.output}:</div>
            <pre className="text-zinc-400 whitespace-pre-wrap text-xs"><ConceptHighlighter text={block.output} /></pre>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
