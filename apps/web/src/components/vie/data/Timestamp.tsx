import { memo } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimestampProps {
  seconds: number;
  onClick?: () => void;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
          'group inline-flex items-center gap-1 text-xs font-mono tabular-nums text-primary transition-colors active:scale-95 duration-150',
          className,
        )}
        aria-label={`Jump to ${formatTimestamp(seconds)}`}
      >
        <Play
          className="h-3.5 w-3.5 shrink-0 fill-current transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover:scale-[1.15]"
          aria-hidden="true"
        />
        <span className="relative">
          {formatTimestamp(seconds)}
          <span
            aria-hidden="true"
            className="absolute start-0 end-0 bottom-[-2px] h-[1.5px] bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-[var(--ease-out-expo)]"
          />
        </span>
      </button>
    );
  }

  return (
    <span className={cn('text-xs font-mono text-muted-foreground tabular-nums', className)}>
      {formatTimestamp(seconds)}
    </span>
  );
});
