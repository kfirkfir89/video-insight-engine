import { memo } from 'react';
import { ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';

interface NumberedBlockProps {
  items: string[];
  variant?: string;
}

/**
 * Renders a numbered list block with optional variant styling.
 * Variants:
 * - cooking_steps: Emerald accent for recipe steps
 */
export const NumberedBlock = memo(function NumberedBlock({ items, variant }: NumberedBlockProps) {
  const isCookingSteps = variant === 'cooking_steps';

  return (
    <BlockWrapper variant="inline">
      {isCookingSteps && (
        <div className="flex items-center gap-1.5 mb-2">
          <ChefHat className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">steps</span>
        </div>
      )}
      <ol className="space-y-2 stagger-children">
        {items.map((item, index) => (
          <li key={index} className="relative pl-10 text-sm min-h-[2rem]">
            {/* Ghost watermark number */}
            <span className="numbered-ghost" aria-hidden="true">{index + 1}</span>
            {/* Gradient badge */}
            <span
              className={cn(
                'absolute left-0 top-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                isCookingSteps
                  ? 'border-success/40 text-success/90'
                  : 'border-primary/40 text-primary/90'
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="text-muted-foreground leading-relaxed">
              <ConceptHighlighter text={item} />
            </span>
          </li>
        ))}
      </ol>
    </BlockWrapper>
  );
});
