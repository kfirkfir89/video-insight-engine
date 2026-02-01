import { memo } from 'react';
import { ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div
      className={cn(
        isCookingSteps && 'border-l-2 border-emerald-400/50 pl-3'
      )}
    >
      {isCookingSteps && (
        <div className="flex items-center gap-1.5 mb-2">
          <ChefHat className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">steps</span>
        </div>
      )}
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-baseline gap-2.5 text-sm">
            <span
              className={cn(
                'w-5 shrink-0 text-right font-medium tabular-nums',
                isCookingSteps
                  ? 'text-emerald-600/70 dark:text-emerald-400/70'
                  : 'text-muted-foreground/70'
              )}
            >
              {index + 1}.
            </span>
            <span className="text-muted-foreground">
              {item}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
});
