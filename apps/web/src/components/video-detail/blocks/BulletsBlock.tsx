import { memo } from 'react';
import { UtensilsCrossed, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div
      className={cn(
        isIngredients && 'border-l-2 border-amber-400/50 pl-3'
      )}
    >
      {isIngredients && (
        <div className="flex items-center gap-1.5 mb-2">
          <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">ingredients</span>
        </div>
      )}
      <ul className={cn('space-y-1', isChecklist && 'pl-0.5')}>
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-baseline gap-2.5 text-sm"
          >
            {isChecklist ? (
              <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 translate-y-0.5" aria-hidden="true" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0 translate-y-1.5" />
            )}
            <span className="text-muted-foreground">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
