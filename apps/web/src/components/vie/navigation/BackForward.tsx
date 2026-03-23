import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackForwardProps {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  backLabel?: string;
  forwardLabel?: string;
  className?: string;
}

/**
 * Back/forward navigation pair.
 * Used in carousels, flashcard decks, step-by-step flows.
 */
export const BackForward = memo(function BackForward({
  onBack,
  onForward,
  backDisabled,
  forwardDisabled,
  backLabel = 'Previous',
  forwardLabel = 'Next',
  className,
}: BackForwardProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={backDisabled}
        className="gap-1 text-xs"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {backLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onForward}
        disabled={forwardDisabled}
        className="gap-1 text-xs"
      >
        {forwardLabel}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
});
