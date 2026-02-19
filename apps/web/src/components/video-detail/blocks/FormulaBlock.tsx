import { memo } from 'react';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { FormulaBlock as FormulaBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface FormulaBlockProps {
  block: FormulaBlockType;
}

/**
 * Renders mathematical formulas.
 * For full LaTeX support, integrate with KaTeX. This provides basic display.
 */
export const FormulaBlock = memo(function FormulaBlock({ block }: FormulaBlockProps) {
  const { latex, description, inline } = block;

  if (!latex) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.formula}
      variant={inline ? 'inline' : 'card'}
      headerIcon={!inline ? <Calculator className="h-4 w-4" /> : undefined}
      headerLabel={!inline ? BLOCK_LABELS.formula : undefined}
    >
      <div className={cn('space-y-2', inline ? 'inline-block' : 'block')}>

        <div
          className={cn(
            'text-center',
            inline
              ? 'inline font-mono bg-muted/20 px-1.5 py-0.5 rounded text-sm'
              : 'bg-muted/20 rounded-lg p-4'
          )}
          role="math"
          aria-label={latex}
        >
          <code className={cn('text-foreground', inline ? 'font-mono' : 'font-serif text-xl')}>{latex}</code>
        </div>

        {description && !inline && (
          <>
            <div className="fade-divider" aria-hidden="true" />
            <p className="text-xs text-muted-foreground text-center font-mono">{description}</p>
          </>
        )}
      </div>
    </BlockWrapper>
  );
});
