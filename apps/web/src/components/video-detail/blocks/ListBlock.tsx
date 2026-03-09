import { memo } from 'react';
import { UtensilsCrossed, CheckCircle2 } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';

interface ListBlockProps {
  items: string[];
  /** Visual variant: ingredients */
  variant?: string;
}

/**
 * Bullet list block — renders unordered lists only.
 * Numbered lists are now routed to StepBlock (simple mode).
 */
export const ListBlock = memo(function ListBlock({ items, variant }: ListBlockProps) {
  if (!items || items.length === 0) return null;

  const isIngredients = variant === 'ingredients';

  return (
    <BlockWrapper variant="inline">
      {isIngredients && (
        <div className="flex items-center gap-1.5 mb-2">
          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">ingredients</span>
        </div>
      )}
      <ul className="space-y-0 stagger-children">
        {items.map((item, index) => (
          <li key={index}>
            <div className="flex items-baseline gap-2.5 text-sm py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-success/50" aria-hidden="true" />
              <span className="text-muted-foreground">
                {item}
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
