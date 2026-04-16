import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Check, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CheckItemProps {
  label: string;
  note?: string;
  checked: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Single checkbox row. Domain-free — no ToolListBlock or IngredientBlock.
 */
export const CheckItem = memo(function CheckItem({
  label,
  note,
  checked,
  onToggle,
  className,
}: CheckItemProps) {
  return (
    <div className={cn('flex items-start gap-2 text-[0.9375rem] py-1.5 transition-colors', checked && 'opacity-70', className)}>
      <Button
        variant="ghost"
        size="icon-bare"
        onClick={onToggle}
        className="shrink-0 mt-0.5 transition-colors"
        aria-label={checked ? `Uncheck ${label}` : `Check ${label}`}
      >
        {checked ? (
          <Check className="h-4 w-4 text-success" aria-hidden="true" />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
        )}
      </Button>
      <div className={cn('flex-1 leading-snug tracking-[-0.005em]', checked && 'line-through text-muted-foreground')}>
        <span className="font-medium">{label}</span>
        {note && (
          <span className="text-[0.8125rem] font-normal text-muted-foreground ms-2" aria-hidden="true">
            · {note}
          </span>
        )}
      </div>
    </div>
  );
});
