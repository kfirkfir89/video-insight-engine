import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/vie';

interface EmptyTabStateProps {
  /** Short, declarative message — no hedge. e.g. "No steps were extracted for this video." */
  message: string;
  /** Lucide glyph shown above the message. Defaults to a generic inbox. */
  icon?: LucideIcon;
  className?: string;
}

/**
 * Canonical empty-state for interactive output tabs.
 *
 * A tab can pass the backend density gate yet still filter every item out at
 * render (e.g. an info_grid that drops all keyless rows). Before this existed,
 * ~19 components bare-`return null`ed in that case and the user landed on a tab
 * showing only an italic intro line and whitespace — which reads as a bug.
 * Every interactive component renders this instead, so an empty tab always says
 * something instead of nothing.
 */
export function EmptyTabState({ message, icon: Icon = Inbox, className }: EmptyTabStateProps) {
  return (
    <GlassCard
      variant="outlined"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-center',
        className,
      )}
    >
      <Icon className="h-7 w-7 shrink-0 text-muted-foreground/50" aria-hidden="true" />
      <p className="max-w-sm text-sm text-muted-foreground" role="status">
        {message}
      </p>
    </GlassCard>
  );
}
