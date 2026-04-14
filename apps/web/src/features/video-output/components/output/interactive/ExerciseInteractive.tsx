import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dumbbell, Clock, RotateCcw, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard, FadeIn, SectionNav, HeroCard, Badge, StatPill } from '@/components/vie';
import { Celebration } from '../Celebration';
import { useLabels } from '@/lib/i18n';

import type { FitnessExercise } from '@vie/types';

interface ExerciseInteractiveProps {
  exercises: FitnessExercise[];
  warmup?: string[] | FitnessExercise[];
  cooldown?: string[] | FitnessExercise[];
  meta?: {
    type?: string;
    difficulty?: string;
    duration?: number;
    equipment?: string[];
    muscleGroups?: string[];
  };
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

const DIFFICULTY_BADGE: Record<string, 'success' | 'warning' | 'destructive'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'destructive',
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

function FormCueCallout({ cue }: { cue: string }) {
  const t = useLabels();
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-info font-medium hover:underline"
      >
        {open ? t.hideFormCue : t.formCue}
      </button>
      {open && (
        <p className="text-muted-foreground bg-info/5 rounded-md px-2.5 py-1.5 mt-1">
          {cue}
        </p>
      )}
    </div>
  );
}

export const ExerciseInteractive = memo(function ExerciseInteractive({
  exercises, warmup, cooldown, meta, nextTab, onNavigateTab,
}: ExerciseInteractiveProps) {
  const t = useLabels();
  const [completedSets, setCompletedSets] = useState<Map<number, number>>(new Map());
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('exercises');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const warmupStrings = useMemo(() => {
    if (!warmup || warmup.length === 0) return [];
    return warmup.map((w) => typeof w === 'string' ? w : w.name);
  }, [warmup]);

  const cooldownStrings = useMemo(() => {
    if (!cooldown || cooldown.length === 0) return [];
    return cooldown.map((c) => typeof c === 'string' ? c : c.name);
  }, [cooldown]);

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

  const sections = [
    ...(warmupStrings.length > 0 ? [{ id: 'warmup', label: 'Warm-up' }] : []),
    { id: 'exercises', label: 'Exercises' },
    ...(cooldownStrings.length > 0 ? [{ id: 'cooldown', label: 'Cool-down' }] : []),
  ];
  const hasMultipleSections = sections.length > 1;

  return (
    <div className="space-y-4">
      {/* Hero card with meta */}
      {meta && (
        <HeroCard emoji="💪" title={meta.type ?? 'Workout'} subtitle={meta.difficulty}>
          <div className="flex flex-wrap gap-2 mt-2">
            {meta.duration && <StatPill value={`${meta.duration}m`} label={t.duration} />}
            {meta.equipment && meta.equipment.length > 0 && (
              <StatPill value={meta.equipment.join(', ')} label={t.equipment} />
            )}
          </div>
        </HeroCard>
      )}

      {/* Rest timer banner */}
      {restTimer !== null && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-info/10 border border-info/20 px-4 py-3">
          <RotateCcw className="h-4 w-4 text-info animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium text-info tabular-nums">Rest: {restTimer}s</span>
          <Button variant="ghost" size="sm" onClick={() => { setRestTimer(null); if (timerRef.current) clearInterval(timerRef.current); }} className="text-xs">Skip</Button>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />Progress</span>
        <span>{doneSets}/{totalSets} sets</span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }} />
      </div>

      {/* Section nav */}
      {hasMultipleSections && (
        <SectionNav sections={sections} activeId={activeSection} onSelect={setActiveSection} />
      )}

      {/* Section content */}
      {activeSection === 'warmup' && warmupStrings.length > 0 && (
        <SimpleList title="Warm-up" items={warmupStrings} color="warning" />
      )}

      {activeSection === 'exercises' && exercises.map((exercise, index) => {
        const done = completedSets.get(index) ?? 0;
        const target = exercise.sets ?? 1;
        const exerciseDone = done >= target;
        const formCue = exercise.formCues?.[0];
        return (
          <FadeIn key={index} index={index}>
            <GlassCard variant="interactive" className={cn(exerciseDone && 'opacity-60')}>
              <div className="flex gap-3">
                {/* Left: content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold">
                      <span className="me-1.5">{exercise.emoji}</span>{exercise.name}
                    </h4>
                    {exercise.difficulty && (
                      <Badge variant={DIFFICULTY_BADGE[exercise.difficulty] ?? 'muted'} className="text-[10px]">
                        {exercise.difficulty}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {exercise.sets && <span><b className="text-foreground">{exercise.sets}</b> sets</span>}
                    {exercise.reps && <span><b className="text-foreground">{exercise.reps}</b> reps</span>}
                    {exercise.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{exercise.duration}</span>}
                  </div>

                  {/* Form cue — collapsed callout */}
                  {formCue && (
                    <FormCueCallout cue={formCue} />
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground tabular-nums">{done}/{target} sets done</span>
                    <Button variant={exerciseDone ? 'ghost' : 'outline'} size="sm" onClick={() => completeSet(index, exercise)} disabled={exerciseDone} className="gap-1.5 text-xs">
                      {exerciseDone ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> {t.done}</> : <><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t.completeSet}</>}
                    </Button>
                  </div>
                </div>

                {/* Right: 72px thumbnail */}
                {(exercise as FitnessExercise & { thumbnailUrl?: string; }).thumbnailUrl && (
                  <img
                    src={(exercise as FitnessExercise & { thumbnailUrl?: string; }).thumbnailUrl!}
                    alt={exercise.name}
                    loading="lazy"
                    className="w-[72px] h-[72px] rounded-lg object-cover shrink-0 border border-border/30 self-start"
                  />
                )}
              </div>
            </GlassCard>
          </FadeIn>
        );
      })}

      {activeSection === 'cooldown' && cooldownStrings.length > 0 && (
        <SimpleList title="Cool-down" items={cooldownStrings} color="info" />
      )}

      {allDone && (
        <Celebration emoji="💪" title={t.workoutComplete} subtitle={t.allSetsFinished} nextTabId={nextTab} nextLabel={nextTab ? 'Continue' : undefined} onNavigateTab={onNavigateTab} />
      )}
    </div>
  );
});
