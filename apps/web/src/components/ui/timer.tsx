import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface TimerProps {
  /** Initial time in seconds */
  initialSeconds?: number;
  /** Count direction */
  mode?: 'countdown' | 'countup';
  /** Auto-start on mount */
  autoStart?: boolean;
  /** Callback when timer completes (countdown only) */
  onComplete?: () => void;
  /** Callback on each tick */
  onTick?: (seconds: number) => void;
  /** Show controls */
  showControls?: boolean;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Timer component with countdown/countup modes.
 * Supports start, pause, and reset controls.
 */
export const Timer = memo(function Timer({
  initialSeconds = 0,
  mode = 'countdown',
  autoStart = false,
  onComplete,
  onTick,
  showControls = true,
  className,
  size = 'md',
}: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = mode === 'countdown' ? prev - 1 : prev + 1;

          if (mode === 'countdown' && next <= 0) {
            setIsRunning(false);
            onComplete?.();
            return 0;
          }

          onTick?.(next);
          return next;
        });
      }, 1000);
    } else {
      clearTimer();
    }

    return clearTimer;
  }, [isRunning, mode, onComplete, onTick, clearTimer]);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div
      className={cn('flex items-center gap-3', className)}
      role="timer"
      aria-label={`Timer: ${formatTime(seconds)}`}
    >
      <span className={cn('font-mono tabular-nums', sizeClasses[size])}>
        {formatTime(seconds)}
      </span>

      {showControls && (
        <div className="flex items-center gap-1">
          {isRunning ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={pause}
              className="h-8 w-8"
              aria-label="Pause timer"
            >
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={start}
              className="h-8 w-8"
              aria-label="Start timer"
              disabled={mode === 'countdown' && seconds === 0}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={reset}
            className="h-8 w-8"
            aria-label="Reset timer"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
});

// Export hook for custom timer usage
export function useTimer(initialSeconds: number, mode: 'countdown' | 'countup' = 'countdown') {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = mode === 'countdown' ? prev - 1 : prev + 1;
          if (mode === 'countdown' && next <= 0) {
            setIsRunning(false);
            return 0;
          }
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, mode]);

  return {
    seconds,
    isRunning,
    start,
    pause,
    reset,
    formatted: formatTime(seconds),
  };
}
