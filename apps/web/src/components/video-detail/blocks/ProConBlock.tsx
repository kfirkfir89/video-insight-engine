import { memo } from 'react';
import { Plus, Minus } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
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
      variant="transparent"
      label="Pros and cons comparison"
    >
      {/* Split color bar */}
      {hasPros && hasCons && (
        <div className="mb-4">
          <div className="pro-con-bar" aria-hidden="true">
            <div
              className="bg-success/60 progress-bar-animated"
              style={{ width: `${Math.round((block.pros.length / (block.pros.length + block.cons.length)) * 100)}%`, transformOrigin: 'left' }}
            />
            <div
              className="bg-destructive/60 progress-bar-animated"
              style={{ width: `${Math.round((block.cons.length / (block.pros.length + block.cons.length)) * 100)}%`, transformOrigin: 'right', animationDelay: '150ms' }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Pros column */}
        {hasPros && (
          <div className="p-4 bg-success/[0.04] rounded-lg">
            <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-success/20">
              <Plus className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="text-xs font-medium text-success">
                {BLOCK_LABELS.pros}
              </span>
            </div>
            <ul className="space-y-1.5 stagger-children" aria-label={BLOCK_LABELS.pros}>
              {block.pros.map((pro, index) => (
                <li key={index} className="flex items-baseline gap-2.5 text-sm">
                  <Plus className="h-3 w-3 shrink-0 text-success/60 translate-y-0.5" aria-hidden="true" />
                  <span className="text-muted-foreground">{pro ? <ConceptHighlighter text={pro} /> : '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cons column */}
        {hasCons && (
          <div className="p-4 bg-destructive/[0.04] rounded-lg">
            <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-destructive/20">
              <Minus className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
              <span className="text-xs font-medium text-destructive">
                {BLOCK_LABELS.cons}
              </span>
            </div>
            <ul className="space-y-1.5 stagger-children" aria-label={BLOCK_LABELS.cons}>
              {block.cons.map((con, index) => (
                <li key={index} className="flex items-baseline gap-2.5 text-sm">
                  <Minus className="h-3 w-3 shrink-0 text-destructive/60 translate-y-0.5" aria-hidden="true" />
                  <span className="text-muted-foreground">{con ? <ConceptHighlighter text={con} /> : '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
