import { memo, useState, useCallback } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
    <Button
      variant="ghost"
      size="icon-bare"
      onClick={handleCopy}
      className={cn(
        'text-xs px-2 py-1 transition-colors hover:bg-white/10',
        copied ? 'text-success code-copied-glow' : 'text-[var(--code-muted)]'
      )}
      aria-label={copied ? BLOCK_LABELS.copied : BLOCK_LABELS.copyCode}
    >
      {copied ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </Button>
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
          <span className="whitespace-pre-wrap"><ConceptHighlighter text={block.command} /></span>
        </div>

        {/* Output */}
        {block.output && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs text-[var(--code-dim)] mb-1">{BLOCK_LABELS.output}:</div>
            <pre className="text-[var(--code-muted)] whitespace-pre-wrap text-xs"><ConceptHighlighter text={block.output} /></pre>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
