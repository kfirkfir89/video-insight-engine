import { memo } from 'react';
import { UtensilsCrossed, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';

interface BulletsBlockProps {
  items: string[];
  variant?: string;
}

/**
 * Renders a bullet list block with optional variant styling.
 * Variants:
 * - ingredients: Warm amber styling for recipe content
 * - checklist: Checkbox-style for todo/action items
 */
export const BulletsBlock = memo(function BulletsBlock({ items, variant }: BulletsBlockProps) {
  const isIngredients = variant === 'ingredients';
  const isChecklist = variant === 'checklist';

  return (
    <BlockWrapper variant="inline">
      {isIngredients && (
        <div className="flex items-center gap-1.5 mb-2">
          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">ingredients</span>
        </div>
      )}
      <ul className={cn('space-y-0 stagger-children', isChecklist && 'pl-0.5')}>
        {items.map((item, index) => (
          <li key={index}>
            <div className="flex items-baseline gap-2.5 text-sm py-1.5">
              <CheckCircle2 className={cn(
                "h-3.5 w-3.5 shrink-0 translate-y-0.5",
                isChecklist ? "text-primary/50" : "text-success/50"
              )} aria-hidden="true" />
              <span className="text-muted-foreground">
                <ConceptHighlighter text={item} />
              </span>
            </div>
            {index < items.length - 1 && (
              <div className="fade-divider" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </BlockWrapper>
  );
});
