import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        className="group gap-1 text-xs font-medium"
      >
        <ChevronLeft
          className="h-3.5 w-3.5 rtl:rotate-180 transition-transform duration-150 ease-[var(--ease-out-expo)] group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        {backLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onForward}
        disabled={forwardDisabled}
        className="group gap-1 text-xs font-medium"
      >
        {forwardLabel}
        <ChevronRight
          className="h-3.5 w-3.5 rtl:rotate-180 transition-transform duration-150 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Button>
    </div>
  );
});
