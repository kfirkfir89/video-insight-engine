import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimerProps {
  /** Duration in seconds */
  duration: number;
  /** Auto-start on mount */
  autoStart?: boolean;
  onComplete?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Countdown timer with play/pause/reset controls.
 */
export const Timer = memo(function Timer({
  duration,
  autoStart = false,
  onComplete,
  className,
}: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(autoStart);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const reset = useCallback(() => {
    setRemaining(duration);
    setRunning(false);
  }, [duration]);

  const percent = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;
  const urgency: 'critical' | 'warning' | 'normal' =
    remaining > 0 && remaining <= 3 ? 'critical' : remaining > 0 && remaining <= 10 ? 'warning' : 'normal';
  const digitColor =
    urgency === 'critical' ? 'text-destructive' : urgency === 'warning' ? 'text-warning' : 'text-foreground';
  const barColor =
    urgency === 'critical' ? 'bg-destructive' : urgency === 'warning' ? 'bg-warning' : 'bg-primary';

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <span
        className={cn(
          'text-4xl font-mono font-bold tabular-nums tracking-tight transition-colors',
          digitColor,
        )}
        aria-live="polite"
      >
        {formatTime(remaining)}
      </span>
      <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000 linear', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRunning((p) => !p)}
          className="gap-1.5"
          aria-label={running ? 'Pause' : 'Start'}
        >
          {running ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {running ? 'Pause' : 'Start'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="gap-1.5"
          aria-label="Reset timer"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </Button>
      </div>
    </div>
  );
});
