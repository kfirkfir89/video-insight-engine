import { memo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { DoDoNotBlock } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface DosDontsBlockProps {
  block: DoDoNotBlock;
}

/**
 * Renders a two-column Do/Don't comparison with row-aligned grid.
 * Fade dividers between rows, vertical divider at center.
 */
export const DosDontsBlock = memo(function DosDontsBlock({ block }: DosDontsBlockProps) {
  const hasDos = Array.isArray(block.do) && block.do.length > 0;
  const hasDonts = Array.isArray(block.dont) && block.dont.length > 0;

  if (!hasDos && !hasDonts) return null;

  const maxRows = Math.max(
    hasDos ? block.do.length : 0,
    hasDonts ? block.dont.length : 0
  );

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label="Do's and Don'ts comparison"
    >
      {hasDos && hasDonts ? (
        <div className="relative">
          {/* Column headers */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="flex items-center gap-1.5 px-4 pb-2 mb-1 border-b border-success/20">
              <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="text-xs font-medium text-success">{BLOCK_LABELS.dos}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-2 mb-1 border-b border-destructive/20">
              <X className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
              <span className="text-xs font-medium text-destructive">{BLOCK_LABELS.donts}</span>
            </div>
          </div>

          {/* Vertical center divider (desktop only) */}
          <div className="fade-divider-vertical absolute left-1/2 top-8 bottom-2 -translate-x-px hidden sm:block" aria-hidden="true" />

          {/* Row-by-row rendering */}
          {Array.from({ length: maxRows }).map((_, rowIndex) => {
            const doItem = block.do[rowIndex];
            const dontItem = block.dont[rowIndex];
            return (
              <div key={rowIndex}>
                {rowIndex > 0 && <div className="fade-divider" aria-hidden="true" />}
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <div className="px-4 py-1.5 bg-success/[0.04]">
                    {doItem ? (
                      <div className="flex items-baseline gap-2.5 text-sm">
                        <span className="w-1 h-1 rounded-full bg-success-soft shrink-0 translate-y-1.5" />
                        <span className="text-muted-foreground"><ConceptHighlighter text={doItem} /></span>
                      </div>
                    ) : (
                      <div className="min-h-[1.5rem]" />
                    )}
                  </div>
                  <div className="px-4 py-1.5 bg-destructive/[0.04]">
                    {dontItem ? (
                      <div className="flex items-baseline gap-2.5 text-sm">
                        <span className="w-1 h-1 rounded-full bg-destructive/10 shrink-0 translate-y-1.5" />
                        <span className="text-muted-foreground"><ConceptHighlighter text={dontItem} /></span>
                      </div>
                    ) : (
                      <div className="min-h-[1.5rem]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Single column fallback */
        <div className={cn('p-4 rounded-lg', hasDos ? 'bg-success/[0.04]' : 'bg-destructive/[0.04]')}>
          <div className={cn('flex items-center gap-1.5 pb-2 mb-3 border-b', hasDos ? 'border-success/20' : 'border-destructive/20')}>
            {hasDos ? <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" /> : <X className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />}
            <span className={cn('text-xs font-medium', hasDos ? 'text-success' : 'text-destructive')}>
              {hasDos ? BLOCK_LABELS.dos : BLOCK_LABELS.donts}
            </span>
          </div>
          <ul className="space-y-0 stagger-children" aria-label={hasDos ? BLOCK_LABELS.dos : BLOCK_LABELS.donts}>
            {(hasDos ? block.do : block.dont).map((item, index, arr) => (
              <li key={index}>
                <div className="flex items-baseline gap-2.5 text-sm py-1.5">
                  <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', hasDos ? 'bg-success-soft' : 'bg-destructive/10')} />
                  <span className="text-muted-foreground"><ConceptHighlighter text={item} /></span>
                </div>
                {index < arr.length - 1 && <div className="fade-divider" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlockWrapper>
  );
});
