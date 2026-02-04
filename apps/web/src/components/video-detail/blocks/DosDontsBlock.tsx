import { memo } from 'react';
import { Check, X } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { DoDoNotBlock } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface DosDontsBlockProps {
  block: DoDoNotBlock;
}

/**
 * Renders a two-column Do/Don't comparison.
 * Extracted from ContentBlockRenderer for better modularity.
 */
export const DosDontsBlock = memo(function DosDontsBlock({ block }: DosDontsBlockProps) {
  const hasDos = Array.isArray(block.do) && block.do.length > 0;
  const hasDonts = Array.isArray(block.dont) && block.dont.length > 0;

  if (!hasDos && !hasDonts) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="Do's and Don'ts comparison"
    >
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {/* Do column */}
          {hasDos && (
            <div className="p-4 sm:border-r border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-emerald-500/30">
                <Check className="h-3.5 w-3.5 text-emerald-600/80 dark:text-emerald-400/80" aria-hidden="true" />
                <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">
                  {BLOCK_LABELS.dos}
                </span>
              </div>
              <ul className="space-y-1.5" aria-label={BLOCK_LABELS.dos}>
                {block.do.map((item, index) => (
                  <li key={index} className="flex items-baseline gap-2.5 text-sm">
                    <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0 translate-y-1.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Don't column */}
          {hasDonts && (
            <div className="p-4 border-t sm:border-t-0 border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-rose-500/30">
                <X className="h-3.5 w-3.5 text-rose-600/80 dark:text-rose-400/80" aria-hidden="true" />
                <span className="text-xs font-medium text-rose-600/80 dark:text-rose-400/80">
                  {BLOCK_LABELS.donts}
                </span>
              </div>
              <ul className="space-y-1.5" aria-label={BLOCK_LABELS.donts}>
                {block.dont.map((item, index) => (
                  <li key={index} className="flex items-baseline gap-2.5 text-sm">
                    <span className="w-1 h-1 rounded-full bg-rose-500/60 shrink-0 translate-y-1.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </BlockWrapper>
  );
});
