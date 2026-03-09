import type { WorkoutOutput, WorkoutExercise } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface WorkoutTabsProps {
  data: WorkoutOutput;
  activeTab: string;
}

export function WorkoutTabs({ data, activeTab }: WorkoutTabsProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="flex flex-col gap-4">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <GlassCard className="text-center py-3">
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm font-bold capitalize">{data.meta.type}</p>
            </GlassCard>
            <GlassCard className="text-center py-3">
              <p className="text-xs text-muted-foreground">Difficulty</p>
              <p className={cn(
                'text-sm font-bold capitalize',
                data.meta.difficulty === 'beginner' && 'text-green-600 dark:text-green-400',
                data.meta.difficulty === 'intermediate' && 'text-yellow-600 dark:text-yellow-400',
                data.meta.difficulty === 'advanced' && 'text-red-600 dark:text-red-400',
              )}>
                {data.meta.difficulty}
              </p>
            </GlassCard>
            <GlassCard className="text-center py-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-bold">{data.meta.duration}min</p>
            </GlassCard>
          </div>
          {/* Muscle groups */}
          {data.meta.muscleGroups.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-2">Muscle Groups</h4>
              <div className="flex flex-wrap gap-2">
                {data.meta.muscleGroups.map((mg) => (
                  <span key={mg} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {mg}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}
          {/* Equipment */}
          {data.meta.equipment.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-2">Equipment</h4>
              <div className="flex flex-wrap gap-2">
                {data.meta.equipment.map((eq) => (
                  <span key={eq} className="rounded-full bg-muted px-3 py-1 text-xs">{eq}</span>
                ))}
              </div>
            </GlassCard>
          )}
          {data.meta.caloriesBurned !== undefined && (
            <p className="text-sm text-muted-foreground text-center">
              Estimated burn: <span className="font-semibold text-foreground">{data.meta.caloriesBurned} cal</span>
            </p>
          )}
        </div>
      );

    case 'exercises':
      return (
        <div className="flex flex-col gap-4">
          {/* Warmup */}
          {data.warmup.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Warmup</h4>
              <div className="flex flex-col gap-2">
                {data.warmup.map((ex, i) => (
                  <ExerciseCard key={i} exercise={ex} />
                ))}
              </div>
            </div>
          )}
          {/* Main exercises */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Main Workout</h4>
            <div className="flex flex-col gap-2">
              {data.exercises.map((ex, i) => (
                <ExerciseCard key={i} exercise={ex} />
              ))}
            </div>
          </div>
          {/* Cooldown */}
          {data.cooldown.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cooldown</h4>
              <div className="flex flex-col gap-2">
                {data.cooldown.map((ex, i) => (
                  <ExerciseCard key={i} exercise={ex} />
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case 'timer':
      return (
        <div className="flex flex-col gap-4">
          {data.timer ? (
            <>
              <GlassCard variant="elevated" className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Rounds</p>
                <p className="text-3xl font-bold mt-1">{data.timer.rounds}</p>
              </GlassCard>
              <div className="flex flex-col gap-2">
                {data.timer.intervals.map((interval, i) => {
                  const typeColors: Record<string, string> = {
                    work: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
                    rest: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
                    warmup: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400',
                    cooldown: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
                  };
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-4 py-3',
                        typeColors[interval.type] ?? '',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase">{interval.type}</span>
                        <span className="text-sm font-medium">{interval.name}</span>
                      </div>
                      <span className="text-lg font-bold font-mono">{interval.duration}s</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <GlassCard className="text-center py-8">
              <p className="text-sm text-muted-foreground">No timer intervals defined for this workout.</p>
            </GlassCard>
          )}
        </div>
      );

    case 'tips':
      return (
        <div className="flex flex-col gap-3">
          {data.tips.map((tip, i) => {
            const typeConfig: Record<string, { bg: string; label: string }> = {
              form: { bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', label: 'Form' },
              safety: { bg: 'bg-red-500/10 text-red-700 dark:text-red-400', label: 'Safety' },
              progression: { bg: 'bg-green-500/10 text-green-700 dark:text-green-400', label: 'Progression' },
            };
            const config = typeConfig[tip.type] ?? typeConfig.form;
            return (
              <GlassCard key={i}>
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium mb-1', config.bg)}>
                  {config.label}
                </span>
                <p className="text-sm leading-relaxed">{tip.text}</p>
              </GlassCard>
            );
          })}
        </div>
      );

    default:
      return null;
  }
}

/** Reusable exercise card */
function ExerciseCard({ exercise }: { exercise: WorkoutExercise }) {
  return (
    <GlassCard variant="interactive">
      <div className="flex gap-3">
        <span className="text-2xl shrink-0">{exercise.emoji}</span>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <h4 className="text-sm font-semibold">{exercise.name}</h4>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {exercise.sets !== undefined && <span>{exercise.sets} sets</span>}
            {exercise.reps && <span>{exercise.reps} reps</span>}
            {exercise.duration && <span>{exercise.duration}</span>}
            {exercise.rest && <span>Rest: {exercise.rest}</span>}
          </div>
          {exercise.formCues.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {exercise.formCues.map((cue, i) => (
                <li key={i} className="text-xs text-muted-foreground/80">{'\u2022'} {cue}</li>
              ))}
            </ul>
          )}
          {exercise.modifications.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {exercise.modifications.map((mod, i) => (
                <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs" title={mod.description}>
                  {mod.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
