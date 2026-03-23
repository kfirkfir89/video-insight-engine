import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CrossTabButtonProps {
  label: string;
  /** Optional 1-line description shown below the label. */
  description?: string;
  onClick: () => void;
  className?: string;
}

/**
 * Navigation button between tabs.
 * Full-width with accent styling using VIE accent CSS variables.
 */
export const CrossTabButton = memo(function CrossTabButton({
  label,
  description,
  onClick,
  className,
}: CrossTabButtonProps) {
  return (
    <Button
      variant="ghost"
      size="bare"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3 rounded-lg',
        'bg-[var(--vie-accent-muted)] border border-[var(--vie-accent-border)]',
        'text-[var(--vie-accent)] text-sm font-medium',
        'active:scale-[0.97] transition-all duration-150',
        className,
      )}
    >
      <div className="flex flex-col items-start gap-0.5">
        <span>Next: {label} →</span>
        {description && (
          <span className="text-xs font-normal text-muted-foreground">{description}</span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </Button>
  );
});
