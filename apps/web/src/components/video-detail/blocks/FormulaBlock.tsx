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

  // Note: For proper LaTeX rendering, you would integrate KaTeX here:
  // import katex from 'katex';
  // const html = katex.renderToString(latex, { throwOnError: false });
  // Then use dangerouslySetInnerHTML={{ __html: html }}

  // Basic fallback that shows LaTeX as code
  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.formula}
    >
      <div className={cn('space-y-2', inline ? 'inline-block' : 'block')}>
        {!inline && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{BLOCK_LABELS.formula}</span>
          </div>
        )}

        <div
          className={cn(
            'font-mono text-center',
            inline
              ? 'inline bg-muted/30 px-1.5 py-0.5 rounded text-sm'
              : 'bg-muted/30 rounded-lg p-4 text-lg'
          )}
          role="math"
          aria-label={latex}
        >
          {/* Render LaTeX - this is a fallback, integrate KaTeX for proper rendering */}
          <code className="text-foreground">{latex}</code>
        </div>

        {description && !inline && (
          <p className="text-sm text-muted-foreground text-center">{description}</p>
        )}
      </div>
    </BlockWrapper>
  );
});
