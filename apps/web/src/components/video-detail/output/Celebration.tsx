import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface CelebrationProps {
  emoji: string;
  title: string;
  subtitle?: string;
  nextTabId?: string;
  nextLabel?: string;
  onNavigateTab?: (tabId: string) => void;
}

/**
 * Completion celebration component.
 * Green-tinted card with popIn animation. Optional next-tab button.
 */
export const Celebration = memo(function Celebration({
  emoji,
  title,
  subtitle,
  nextTabId,
  nextLabel,
  onNavigateTab,
}: CelebrationProps) {
  return (
    <div
      className={cn(
        'animate-pop-in rounded-lg p-6 text-center',
        'bg-[rgba(52,211,153,0.06)] border border-success/20',
      )}
      role="alert"
    >
      <span className="text-4xl block mb-2" aria-hidden="true">{emoji}</span>
      <h3 className="font-bold text-lg">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
      {nextTabId && nextLabel && onNavigateTab && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateTab(nextTabId)}
          className="mt-4 gap-1.5 text-xs text-[var(--vie-accent)]"
        >
          {nextLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
});
