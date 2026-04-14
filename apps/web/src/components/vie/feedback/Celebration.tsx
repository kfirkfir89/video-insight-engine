import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CelebrationProps {
  emoji: string;
  title: string;
  subtitle?: string;
  /** Render slot for a navigation action (e.g. "Next" button) */
  action?: ReactNode;
  className?: string;
}

export const Celebration = memo(function Celebration({
  emoji,
  title,
  subtitle,
  action,
  className,
}: CelebrationProps) {
  return (
    <div
      className={cn(
        'animate-pop-in rounded-lg p-6 text-center',
        'bg-[rgba(52,211,153,0.06)] border border-success/20',
        className,
      )}
      role="alert"
    >
      <span className="text-4xl block mb-2" aria-hidden="true">{emoji}</span>
      <h3 className="font-bold text-lg">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
});

/** Pre-built next-tab action button for Celebration. */
export const CelebrationNextButton = memo(function CelebrationNextButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="gap-1.5 text-xs text-[var(--vie-accent)]"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
    </Button>
  );
});
