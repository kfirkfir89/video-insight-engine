import { memo } from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { ProConBlock as ProConBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ProConBlockProps {
  block: ProConBlockType;
}

/**
 * Renders a pros vs cons comparison with row-aligned grid.
 * Fade dividers between rows, vertical divider at center.
 */
export const ProConBlock = memo(function ProConBlock({ block }: ProConBlockProps) {
  const hasPros = Array.isArray(block.pros) && block.pros.length > 0;
  const hasCons = Array.isArray(block.cons) && block.cons.length > 0;

  if (!hasPros && !hasCons) return null;

  const maxRows = Math.max(
    hasPros ? block.pros.length : 0,
    hasCons ? block.cons.length : 0
  );

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label="Pros and cons comparison"
    >
      {/* Split color bar */}
      {hasPros && hasCons && (
        <div className="mb-4">
          <div className="pro-con-bar" aria-hidden="true">
            {(() => {
              const total = block.pros.length + block.cons.length;
              const prosPct = total > 0 ? Math.round((block.pros.length / total) * 100) : 50;
              return (
                <>
                  <div
                    className="bg-success/70 progress-bar-animated"
                    style={{ width: `${prosPct}%`, transformOrigin: 'left' }}
                  />
                  <div
                    className="bg-destructive/70 progress-bar-animated"
                    style={{ width: `${100 - prosPct}%`, transformOrigin: 'right', animationDelay: '150ms' }}
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Row-aligned grid */}
      {hasPros && hasCons ? (
        <div className="relative">
          {/* Column headers */}
          <div className="grid grid-cols-2">
            <div className="flex items-center gap-1.5 px-4 pb-2 mb-1 border-b border-success/20">
              <Plus className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="text-xs font-medium text-success">{BLOCK_LABELS.pros}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-2 mb-1 border-b border-destructive/20">
              <Minus className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
              <span className="text-xs font-medium text-destructive">{BLOCK_LABELS.cons}</span>
            </div>
          </div>

          {/* Vertical center divider */}
          <div className="fade-divider-vertical absolute left-1/2 top-8 bottom-2 -translate-x-px" aria-hidden="true" />

          {/* Row-by-row rendering */}
          {Array.from({ length: maxRows }).map((_, rowIndex) => {
            const pro = block.pros[rowIndex];
            const con = block.cons[rowIndex];
            return (
              <div key={rowIndex}>
                {rowIndex > 0 && <div className="fade-divider" aria-hidden="true" />}
                <div className="grid grid-cols-2">
                  <div className={cn('px-4 py-1.5', 'bg-success/[0.04]')}>
                    {pro !== undefined ? (
                      <div className="flex items-baseline gap-2.5 text-sm">
                        <Plus className="h-3 w-3 shrink-0 text-success/70 translate-y-0.5" aria-hidden="true" />
                        <span className="text-muted-foreground">{pro ? <ConceptHighlighter text={pro} /> : '—'}</span>
                      </div>
                    ) : (
                      <div className="min-h-[1.5rem]" />
                    )}
                  </div>
                  <div className={cn('px-4 py-1.5', 'bg-destructive/[0.04]')}>
                    {con !== undefined ? (
                      <div className="flex items-baseline gap-2.5 text-sm">
                        <Minus className="h-3 w-3 shrink-0 text-destructive/70 translate-y-0.5" aria-hidden="true" />
                        <span className="text-muted-foreground">{con ? <ConceptHighlighter text={con} /> : '—'}</span>
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
        /* Single column fallback when only pros or only cons exist */
        <div className="p-4 rounded-lg" style={{ background: hasPros ? 'oklch(from var(--success) l c h / 0.04)' : 'oklch(from var(--destructive) l c h / 0.04)' }}>
          <div className={cn('flex items-center gap-1.5 pb-2 mb-3 border-b', hasPros ? 'border-success/20' : 'border-destructive/20')}>
            {hasPros ? <Plus className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" /> : <Minus className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />}
            <span className={cn('text-xs font-medium', hasPros ? 'text-success' : 'text-destructive')}>
              {hasPros ? BLOCK_LABELS.pros : BLOCK_LABELS.cons}
            </span>
          </div>
          <ul className="space-y-0 stagger-children" aria-label={hasPros ? BLOCK_LABELS.pros : BLOCK_LABELS.cons}>
            {(hasPros ? block.pros : block.cons).map((item, index, arr) => (
              <li key={index}>
                <div className="flex items-baseline gap-2.5 text-sm py-1.5">
                  {hasPros
                    ? <Plus className="h-3 w-3 shrink-0 text-success/70 translate-y-0.5" aria-hidden="true" />
                    : <Minus className="h-3 w-3 shrink-0 text-destructive/70 translate-y-0.5" aria-hidden="true" />
                  }
                  <span className="text-muted-foreground">{item ? <ConceptHighlighter text={item} /> : '—'}</span>
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
