import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TimerProps {
  duration: number;
  autoStart?: boolean;
  onComplete?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const RING_SIZE = 120;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE * 2) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

/**
 * Circular countdown timer. CSS stroke-dashoffset transition + CSS pulse on critical.
 */
export const Timer = memo(function Timer({
  duration,
  autoStart = false,
  onComplete,
  className,
}: TimerProps) {
  const [remaining, setRemaining] = useState<number>(duration);
  const [running, setRunning] = useState<boolean>(autoStart);
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

  const percent = duration > 0 ? (duration - remaining) / duration : 0;
  const urgency: 'critical' | 'warning' | 'normal' =
    remaining > 0 && remaining <= 3 ? 'critical' : remaining > 0 && remaining <= 10 ? 'warning' : 'normal';

  const ringColor =
    urgency === 'critical' ? 'var(--destructive)' : urgency === 'warning' ? 'var(--warning)' : 'var(--primary)';
  const digitColor =
    urgency === 'critical' ? 'text-destructive' : urgency === 'warning' ? 'text-warning' : 'text-foreground';

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90 transition-[filter] duration-300"
          style={{ filter: urgency === 'critical' ? `drop-shadow(0 0 12px ${ringColor})` : undefined }}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={RING_STROKE}
            opacity={0.25}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={RING_CIRC * (1 - percent)}
            style={{ transition: 'stroke-dashoffset 1000ms linear, stroke 300ms ease' }}
          />
        </svg>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            urgency === 'critical' && running && 'animate-[pulse_0.8s_ease-in-out_infinite]',
          )}
        >
          <span
            className={cn(
              'timer-glow text-3xl font-mono font-bold tabular-nums tracking-tight transition-colors',
              digitColor,
            )}
            aria-live="polite"
          >
            {formatTime(remaining)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRunning((p) => !p)}
          className="gap-1.5"
          aria-label={running ? 'Pause' : 'Start'}
        >
          {running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
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
