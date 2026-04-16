import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';

interface TimestampProps {
  /** Time in seconds */
  seconds: number;
  onClick?: () => void;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formatted timestamp badge. Clickable when onClick is provided.
 */
export const Timestamp = memo(function Timestamp({
  seconds,
  onClick,
  className,
}: TimestampProps) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-mono tabular-nums text-primary hover:underline transition-colors',
          className,
        )}
        aria-label={`Jump to ${formatTimestamp(seconds)}`}
      >
        <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
        {formatTimestamp(seconds)}
      </button>
    );
  }

  return (
    <span className={cn('text-xs font-mono text-muted-foreground tabular-nums', className)}>
      {formatTimestamp(seconds)}
    </span>
  );
});
