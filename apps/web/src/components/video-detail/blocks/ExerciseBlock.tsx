import { memo } from 'react';
import { Dumbbell, Play, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import type { ExerciseBlock as ExerciseBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ExerciseBlockProps {
  block: ExerciseBlockType;
  onPlay?: (seconds: number) => void;
}

const DIFFICULTY_CONFIG = {
  beginner: { label: BLOCK_LABELS.beginner, class: 'bg-success-soft text-success badge-glow-success' },
  intermediate: { label: BLOCK_LABELS.intermediate, class: 'bg-warning-soft text-warning badge-glow-warning' },
  advanced: { label: BLOCK_LABELS.advanced, class: 'bg-destructive/10 text-destructive badge-glow-destructive' },
};

/**
 * Renders exercise cards with sets, reps, and optional video timestamps.
 */
export const ExerciseBlock = memo(function ExerciseBlock({ block, onPlay }: ExerciseBlockProps) {
  const exercises = block.exercises ?? [];

  if (exercises.length === 0) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.exercises}
      variant="transparent"
    >
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
});
