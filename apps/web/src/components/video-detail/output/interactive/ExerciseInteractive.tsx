import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dumbbell, Clock, RotateCcw, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from '../GlassCard';
import { Celebration } from '../Celebration';
import { CrossTabLink } from '../CrossTabLink';
import type { FitnessExercise } from '@vie/types';

interface ExerciseInteractiveProps {
  exercises: FitnessExercise[];
  warmup?: string[];
  cooldown?: string[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

const DIFFICULTY_BADGE: Record<string, string> = {
  beginner: 'bg-success-soft text-success',
  intermediate: 'bg-warning-soft text-warning',
  advanced: 'bg-destructive/10 text-destructive',
};

function parseRestSeconds(rest?: string): number {
  if (!rest) return 0;
  const match = rest.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function SimpleList({ title, items, color }: { title: string; items: string[]; color: 'warning' | 'info' }) {
  const cls = color === 'warning' ? { heading: 'text-warning', dot: 'bg-warning/70' } : { heading: 'text-info', dot: 'bg-info/70' };
  return (
    <GlassCard variant="outlined" className="space-y-2">
      <h4 className={cn('text-xs font-bold uppercase tracking-wider', cls.heading)}>{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
            <span className={cn('w-1 h-1 rounded-full shrink-0', cls.dot)} />
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export const ExerciseInteractive = memo(function ExerciseInteractive({
  exercises, warmup, cooldown, nextTab, onNavigateTab,
}: ExerciseInteractiveProps) {
  const [completedSets, setCompletedSets] = useState<Map<number, number>>(new Map());
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSets = useMemo(() => exercises.reduce((s, ex) => s + (ex.sets ?? 1), 0), [exercises]);
  const doneSets = useMemo(() => Array.from(completedSets.values()).reduce((s, v) => s + v, 0), [completedSets]);
  const allDone = doneSets >= totalSets && totalSets > 0;

  const startRestTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestTimer(seconds);
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const completeSet = (index: number, exercise: FitnessExercise) => {
    setCompletedSets((prev) => {
      const next = new Map(prev);
      const current = next.get(index) ?? 0;
      if (current < (exercise.sets ?? 1)) next.set(index, current + 1);
      return next;
    });
    const restSec = parseRestSeconds(exercise.rest);
    if (restSec > 0) startRestTimer(restSec);
  };

  if (exercises.length === 0) return null;

  return (
    <div className="space-y-4">
      {restTimer !== null && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-info/10 border border-info/20 px-4 py-3">
          <RotateCcw className="h-4 w-4 text-info animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium text-info tabular-nums">Rest: {restTimer}s</span>
          <Button variant="ghost" size="sm" onClick={() => { setRestTimer(null); if (timerRef.current) clearInterval(timerRef.current); }} className="text-xs">Skip</Button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />Progress</span>
        <span>{doneSets}/{totalSets} sets</span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }} />
      </div>

      {warmup && warmup.length > 0 && <SimpleList title="Warm-up" items={warmup} color="warning" />}

      {exercises.map((exercise, index) => {
        const done = completedSets.get(index) ?? 0;
        const target = exercise.sets ?? 1;
        const exerciseDone = done >= target;
        return (
          <GlassCard key={index} variant="interactive" className={cn(exerciseDone && 'opacity-60')}>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium"><span className="mr-1.5">{exercise.emoji}</span>{exercise.name}</h4>
                {exercise.difficulty && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0', DIFFICULTY_BADGE[exercise.difficulty])}>{exercise.difficulty}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {exercise.sets && <span><b className="text-foreground">{exercise.sets}</b> sets</span>}
                {exercise.reps && <span><b className="text-foreground">{exercise.reps}</b> reps</span>}
                {exercise.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{exercise.duration}</span>}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground tabular-nums">{done}/{target} sets done</span>
                <Button variant={exerciseDone ? 'ghost' : 'outline'} size="sm" onClick={() => completeSet(index, exercise)} disabled={exerciseDone} className="gap-1.5 text-xs">
                  {exerciseDone ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> Done</> : <><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Complete Set</>}
                </Button>
              </div>
            </div>
          </GlassCard>
        );
      })}

      {cooldown && cooldown.length > 0 && <SimpleList title="Cool-down" items={cooldown} color="info" />}

      {allDone && (
        <Celebration emoji="💪" title="Workout complete!" subtitle="All sets finished. Great effort!" nextTabId={nextTab} nextLabel={nextTab ? 'Continue' : undefined} onNavigateTab={onNavigateTab} />
      )}
      {!allDone && nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Next section" onNavigate={onNavigateTab} />
      )}
    </div>
  );
});
