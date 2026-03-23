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
    <div className={cn('flex items-start gap-2.5 text-sm py-1.5 transition-colors', checked && 'opacity-60', className)}>
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
          <Square className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
        )}
      </Button>
      <div className={cn('flex-1', checked && 'line-through text-muted-foreground/50')}>
        <span className="font-medium">{label}</span>
        {note && <span className="text-xs text-muted-foreground/70 ml-1">({note})</span>}
      </div>
    </div>
  );
});
