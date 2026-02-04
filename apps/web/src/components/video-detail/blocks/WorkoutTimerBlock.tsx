import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import type { WorkoutTimerBlock as WorkoutTimerBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface WorkoutTimerBlockProps {
  block: WorkoutTimerBlockType;
}

const INTERVAL_COLORS = {
  work: 'text-rose-500 bg-rose-500/10',
  rest: 'text-emerald-500 bg-emerald-500/10',
  warmup: 'text-amber-500 bg-amber-500/10',
  cooldown: 'text-sky-500 bg-sky-500/10',
};

const INTERVAL_LABELS = {
  work: BLOCK_LABELS.work,
  rest: BLOCK_LABELS.rest,
  warmup: BLOCK_LABELS.warmup,
  cooldown: BLOCK_LABELS.cooldown,
};

/**
 * Renders an interval workout timer with controls.
 */
export const WorkoutTimerBlock = memo(function WorkoutTimerBlock({ block }: WorkoutTimerBlockProps) {
  const intervals = block.intervals ?? [];
  const rounds = block.rounds ?? 1;

  const [isRunning, setIsRunning] = useState(false);
  const [currentIntervalIndex, setCurrentIntervalIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(intervals[0]?.duration ?? 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (intervals.length === 0) return null;

  const currentInterval = intervals[currentIntervalIndex];
  const isComplete = currentRound > rounds;

  const totalDuration = intervals.reduce((sum, interval) => sum + interval.duration, 0) * rounds;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = useCallback(() => {
    setIsRunning(false);
    setCurrentIntervalIndex(0);
    setCurrentRound(1);
    setTimeRemaining(intervals[0]?.duration ?? 0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [intervals]);

  const toggleTimer = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  useEffect(() => {
    if (isRunning && !isComplete) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Move to next interval
            const nextIndex = currentIntervalIndex + 1;
            if (nextIndex >= intervals.length) {
              // Move to next round
              if (currentRound < rounds) {
                setCurrentRound(r => r + 1);
                setCurrentIntervalIndex(0);
                return intervals[0]?.duration ?? 0;
              } else {
                // Workout complete
                setIsRunning(false);
                setCurrentRound(r => r + 1);
                return 0;
              }
            } else {
              setCurrentIntervalIndex(nextIndex);
              return intervals[nextIndex]?.duration ?? 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isComplete, currentIntervalIndex, currentRound, rounds, intervals]);

  const colorClass = currentInterval ? INTERVAL_COLORS[currentInterval.type] : '';
  const intervalLabel = currentInterval ? INTERVAL_LABELS[currentInterval.type] : '';

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.workoutTimer}
    >
      <div className="rounded-lg border border-border/50 overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">{BLOCK_LABELS.workoutTimer}</span>
          </div>
          {rounds > 1 && (
            <span className="text-xs text-muted-foreground">
              {BLOCK_LABELS.rounds}: {currentRound}/{rounds}
            </span>
          )}
        </div>

        {/* Timer display - aria-live for screen reader announcements */}
        <div
          className={cn('p-6 text-center transition-colors', colorClass)}
          aria-live="polite"
          aria-atomic="true"
        >
          {isComplete ? (
            <div className="space-y-2" role="alert">
              <div className="text-4xl font-bold text-emerald-500">{BLOCK_LABELS.complete}</div>
              <p className="text-sm text-muted-foreground">{BLOCK_LABELS.totalTime}: {formatTime(totalDuration)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium uppercase tracking-wide opacity-80">
                {intervalLabel}: {currentInterval?.name}
              </div>
              <div className="text-5xl font-bold tabular-nums">
                {formatTime(timeRemaining)}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border/50 flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={reset}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {BLOCK_LABELS.reset}
          </Button>
          <Button
            size="sm"
            onClick={toggleTimer}
            disabled={isComplete}
            className="gap-1.5"
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                {BLOCK_LABELS.pause}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                {timeRemaining === (intervals[0]?.duration ?? 0) && currentRound === 1 ? BLOCK_LABELS.start : BLOCK_LABELS.resume}
              </>
            )}
          </Button>
        </div>

        {/* Interval preview */}
        <div className="px-4 pb-4">
          <div className="flex gap-1">
            {intervals.map((interval, index) => (
              <div
                key={index}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  index < currentIntervalIndex ? 'bg-primary' :
                  index === currentIntervalIndex ? INTERVAL_COLORS[interval.type].replace('text-', 'bg-').replace('/10', '') :
                  'bg-muted'
                )}
                title={`${INTERVAL_LABELS[interval.type]}: ${formatTime(interval.duration)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </BlockWrapper>
  );
});
