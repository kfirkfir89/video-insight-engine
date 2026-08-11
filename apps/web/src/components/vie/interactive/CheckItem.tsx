import { memo } from 'react';
import { Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CheckItemProps {
  label: string;
  note?: string;
  checked: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Single checkbox row. Domain-free.
 * Icon swap via layered opacity/scale transitions — no motion runtime.
 */
export const CheckItem = memo(function CheckItem({
  label,
  note,
  checked,
  onToggle,
  className,
}: CheckItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 text-[0.9375rem] py-1.5 rounded-md transition-opacity',
        checked && 'opacity-80',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-bare"
        onClick={onToggle}
        /* 44×44 hit target (WCAG 2.5.5) — the checkbox glyph stays 16px but
           the button reserves enough slop for touch input. */
        className="shrink-0 mt-0.5 relative min-h-11 min-w-11 items-center justify-center"
        aria-label={checked ? `Uncheck ${label}` : `Check ${label}`}
      >
        <span className="relative inline-block h-4 w-4" aria-hidden="true">
          <Square
            className={cn(
              'absolute inset-0 h-4 w-4 text-muted-foreground/60 transition-all duration-200 ease-[var(--ease-out-expo)]',
              checked ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
            )}
          />
          <Check
            className={cn(
              'absolute inset-0 h-4 w-4 text-success transition-all duration-300 ease-[var(--ease-out-expo)]',
              checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
            )}
          />
        </span>
      </Button>
      <div
        className={cn(
          'flex-1 leading-snug tracking-[-0.005em] transition-colors',
          checked && 'line-through text-muted-foreground',
        )}
      >
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
