import { memo, useCallback, useEffect, useRef, useReducer } from 'react';
import { Dumbbell, Play, Pause, Clock, RotateCcw, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/string-utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BlockWrapper } from './BlockWrapper';
import type { ExerciseBlock, WorkoutTimerBlock } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ExerciseCardProps {
  block: ExerciseBlock | WorkoutTimerBlock;
  onPlay?: (seconds: number) => void;
}

const DIFFICULTY_CONFIG = {
  beginner: { label: BLOCK_LABELS.beginner, class: 'bg-success-soft text-success badge-glow-success' },
  intermediate: { label: BLOCK_LABELS.intermediate, class: 'bg-warning-soft text-warning badge-glow-warning' },
  advanced: { label: BLOCK_LABELS.advanced, class: 'bg-destructive/10 text-destructive badge-glow-destructive' },
};

const INTERVAL_COLORS = {
  work: 'text-destructive bg-destructive/10',
  rest: 'text-success bg-success-soft',
  warmup: 'text-warning bg-warning-soft',
  cooldown: 'text-info bg-info/10',
};

const INTERVAL_PROGRESS_COLORS = {
  work: 'bg-destructive',
  rest: 'bg-success',
  warmup: 'bg-warning',
  cooldown: 'bg-info',
};

const INTERVAL_LABELS = {
  work: BLOCK_LABELS.work,
  rest: BLOCK_LABELS.rest,
  warmup: BLOCK_LABELS.warmup,
  cooldown: BLOCK_LABELS.cooldown,
};

/**
 * Unified fitness block — renders exercises or workout timer.
 * Merges ExerciseBlock + WorkoutTimerBlock into one component.
 */
export const ExerciseCard = memo(function ExerciseCard({ block, onPlay }: ExerciseCardProps) {
  if (block.type === 'workout_timer') {
    return <WorkoutTimer block={block} />;
  }
  return <ExerciseList block={block} onPlay={onPlay} />;
});

// ── Exercise List ──

function ExerciseList({ block, onPlay }: { block: ExerciseBlock; onPlay?: (seconds: number) => void }) {
  const exercises = block.exercises ?? [];
  if (exercises.length === 0) return null;

  return (
    <BlockWrapper blockId={block.blockId} label={BLOCK_LABELS.exercises} variant="transparent">
      <div className="block-label-minimal">
        <Dumbbell className="h-3 w-3" aria-hidden="true" />
        <span>{BLOCK_LABELS.exercises}</span>
      </div>
      <div className="stagger-children">
        {exercises.map((exercise, index) => {
          const difficultyConfig = exercise.difficulty ? DIFFICULTY_CONFIG[exercise.difficulty] : null;
          return (
            <div key={index}>
              <div className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm">{exercise.name}</h4>
                  {difficultyConfig && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', difficultyConfig.class)}>
                      {difficultyConfig.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {exercise.sets && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{exercise.sets}</span>
                      <span>{BLOCK_LABELS.sets}</span>
                    </span>
                  )}
                  {exercise.reps && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{exercise.reps}</span>
                      <span>{BLOCK_LABELS.reps}</span>
                    </span>
                  )}
                  {exercise.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{exercise.duration}</span>
                    </span>
                  )}
                  {exercise.rest && (
                    <span className="flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      <span>{BLOCK_LABELS.rest}: {exercise.rest}</span>
                    </span>
                  )}
                </div>
                {exercise.notes && (
                  <p className="text-xs text-muted-foreground/70 italic">{exercise.notes}</p>
                )}
                {exercise.timestamp !== undefined && onPlay && (
                  <Button
                    variant="ghost"
                    size="bare"
                    onClick={() => onPlay(exercise.timestamp!)}
                    className="text-xs text-primary hover:underline"
                  >
                    <Play className="h-3 w-3" aria-hidden="true" />
                    <span>Watch demo</span>
                  </Button>
                )}
              </div>
              {index < exercises.length - 1 && (
                <div className="fade-divider" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </BlockWrapper>
  );
}

// ── Workout Timer ──

interface TimerState {
  intervalIndex: number;
  round: number;
  remaining: number;
  running: boolean;
}

type TimerAction =
  | { type: 'tick'; intervals: WorkoutTimerBlock['intervals']; rounds: number }
  | { type: 'toggle' }
  | { type: 'reset'; intervals: WorkoutTimerBlock['intervals'] };

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'tick': {
      const intervals = action.intervals ?? [];
      if (state.remaining > 1) {
        return { ...state, remaining: state.remaining - 1 };
      }
      // Current interval finished — advance
      const nextIndex = state.intervalIndex + 1;
      if (nextIndex >= intervals.length) {
        // End of round
        if (state.round < action.rounds) {
          return { ...state, round: state.round + 1, intervalIndex: 0, remaining: intervals[0]?.duration ?? 0 };
        }
        // Workout complete
        return { ...state, round: state.round + 1, running: false, remaining: 0 };
      }
      return { ...state, intervalIndex: nextIndex, remaining: intervals[nextIndex]?.duration ?? 0 };
    }
    case 'toggle':
      return { ...state, running: !state.running };
    case 'reset':
      return { intervalIndex: 0, round: 1, remaining: (action.intervals ?? [])[0]?.duration ?? 0, running: false };
    default:
      return state;
  }
}

function WorkoutTimer({ block }: { block: WorkoutTimerBlock }) {
  const intervals = block.intervals ?? [];
  const rounds = block.rounds ?? 1;

  const [timer, dispatch] = useReducer(timerReducer, {
    intervalIndex: 0,
    round: 1,
    remaining: intervals[0]?.duration ?? 0,
    running: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentInterval = intervals[timer.intervalIndex];
  const isComplete = timer.round > rounds;
  const totalDuration = intervals.reduce((sum, interval) => sum + interval.duration, 0) * rounds;

  const reset = useCallback(() => {
    dispatch({ type: 'reset', intervals });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [intervals]);

  const toggleTimer = useCallback(() => {
    dispatch({ type: 'toggle' });
  }, []);

  useEffect(() => {
    if (timer.running && !isComplete) {
      intervalRef.current = setInterval(() => {
        dispatch({ type: 'tick', intervals, rounds });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timer.running, isComplete, intervals, rounds]);

  if (intervals.length === 0) return null;

  const colorClass = currentInterval ? INTERVAL_COLORS[currentInterval.type] : '';
  const intervalLabel = currentInterval ? INTERVAL_LABELS[currentInterval.type] : '';

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.workoutTimer}
      variant="card"
      headerIcon={<Timer className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.workoutTimer}
      headerAction={
        rounds > 1 ? (
          <span className="text-xs text-muted-foreground">
            {BLOCK_LABELS.rounds}: {timer.round}/{rounds}
          </span>
        ) : undefined
      }
    >
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div
          className={cn('p-6 text-center transition-colors', colorClass)}
          aria-live="polite"
          aria-atomic="true"
        >
          {isComplete ? (
            <div className="space-y-2" role="alert">
              <div className="text-4xl font-bold text-success">{BLOCK_LABELS.complete}</div>
              <p className="text-sm text-muted-foreground">{BLOCK_LABELS.totalTime}: {formatDuration(totalDuration)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium uppercase tracking-wide opacity-80">
                {intervalLabel}: {currentInterval?.name}
              </div>
              <div className="text-5xl font-bold tabular-nums text-gradient-primary timer-glow">
                {formatDuration(timer.remaining)}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border/50 glass-surface flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {BLOCK_LABELS.reset}
          </Button>
          <Button size="sm" onClick={toggleTimer} disabled={isComplete} className="gap-1.5">
            {timer.running ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                {BLOCK_LABELS.pause}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                {timer.remaining === (intervals[0]?.duration ?? 0) && timer.round === 1 ? BLOCK_LABELS.start : BLOCK_LABELS.resume}
              </>
            )}
          </Button>
        </div>
        <div className="px-4 pb-4 space-y-2">
          <TooltipProvider delayDuration={400}>
            <div className="flex gap-1 stagger-children">
              {intervals.map((interval, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'flex-1 h-2 rounded-full transition-colors',
                        index < timer.intervalIndex ? 'bg-primary' :
                        index === timer.intervalIndex ? INTERVAL_PROGRESS_COLORS[interval.type] :
                        'bg-muted'
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {INTERVAL_LABELS[interval.type]}: {formatDuration(interval.duration)}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          <div className="flex justify-center gap-1.5" aria-hidden="true">
            {intervals.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === timer.intervalIndex ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </BlockWrapper>
  );
}
