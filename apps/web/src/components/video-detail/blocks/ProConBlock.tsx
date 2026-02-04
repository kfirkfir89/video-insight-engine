import { memo } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { ProConBlock as ProConBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ProConBlockProps {
  block: ProConBlockType;
}

/**
 * Renders a pros vs cons comparison.
 * Extracted from ComparisonRenderer for dedicated pro/con use case.
 */
export const ProConBlock = memo(function ProConBlock({ block }: ProConBlockProps) {
  const hasPros = Array.isArray(block.pros) && block.pros.length > 0;
  const hasCons = Array.isArray(block.cons) && block.cons.length > 0;

  if (!hasPros && !hasCons) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="Pros and cons comparison"
    >
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Pros column */}
          {hasPros && (
            <div className="p-4 md:border-r border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-emerald-500/30">
                <ThumbsUp className="h-3.5 w-3.5 text-emerald-600/80 dark:text-emerald-400/80" aria-hidden="true" />
                <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">
                  {BLOCK_LABELS.pros}
                </span>
              </div>
              <ul className="space-y-1.5" aria-label={BLOCK_LABELS.pros}>
                {block.pros.map((pro, index) => (
                  <li key={index} className="flex items-baseline gap-2.5 text-sm">
                    <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0 translate-y-1.5" />
                    <span className="text-muted-foreground">{pro || '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons column */}
          {hasCons && (
            <div className="p-4 border-t md:border-t-0 border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-rose-500/30">
                <ThumbsDown className="h-3.5 w-3.5 text-rose-600/80 dark:text-rose-400/80" aria-hidden="true" />
                <span className="text-xs font-medium text-rose-600/80 dark:text-rose-400/80">
                  {BLOCK_LABELS.cons}
                </span>
              </div>
              <ul className="space-y-1.5" aria-label={BLOCK_LABELS.cons}>
                {block.cons.map((con, index) => (
                  <li key={index} className="flex items-baseline gap-2.5 text-sm">
                    <span className="w-1 h-1 rounded-full bg-rose-500/60 shrink-0 translate-y-1.5" />
                    <span className="text-muted-foreground">{con || '—'}</span>
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
