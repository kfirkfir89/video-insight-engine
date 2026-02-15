import { memo } from 'react';
import { Check, X } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
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
      variant="transparent"
      label="Do's and Don'ts comparison"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Do column */}
        {hasDos && (
          <div className="p-4 bg-success/[0.04] rounded-lg">
            <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-success/20">
              <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="text-xs font-medium text-success">
                {BLOCK_LABELS.dos}
              </span>
            </div>
            <ul className="space-y-1.5 stagger-children" aria-label={BLOCK_LABELS.dos}>
              {block.do.map((item, index) => (
                <li key={index} className="flex items-baseline gap-2.5 text-sm">
                  <span className="w-1 h-1 rounded-full bg-success-soft shrink-0 translate-y-1.5" />
                  <span className="text-muted-foreground"><ConceptHighlighter text={item} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Don't column */}
        {hasDonts && (
          <div className="p-4 bg-destructive/[0.04] rounded-lg">
            <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-destructive/20">
              <X className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
              <span className="text-xs font-medium text-destructive">
                {BLOCK_LABELS.donts}
              </span>
            </div>
            <ul className="space-y-1.5 stagger-children" aria-label={BLOCK_LABELS.donts}>
              {block.dont.map((item, index) => (
                <li key={index} className="flex items-baseline gap-2.5 text-sm">
                  <span className="w-1 h-1 rounded-full bg-destructive/10 shrink-0 translate-y-1.5" />
                  <span className="text-muted-foreground"><ConceptHighlighter text={item} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
