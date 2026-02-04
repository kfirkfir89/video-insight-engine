import { memo, useMemo } from 'react';
import { Dumbbell, Timer, Heart, Clock } from 'lucide-react';
import type { Section, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface FitnessViewProps {
  section: Section;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for fitness/workout content.
 * Emphasizes:
 * - Workout timer at the top
 * - Exercise list with reps/sets
 * - Form tips and callouts
 * - Video timestamps for demonstrations
 */
export const FitnessView = memo(function FitnessView({
  section,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: FitnessViewProps) {
  // Group blocks by type for fitness-optimized layout
  const { timerBlocks, exerciseBlocks, tipBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const timers: ContentBlock[] = [];
    const exercises: ContentBlock[] = [];
    const tips: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of section.content ?? []) {
      if (block.type === 'workout_timer') {
        timers.push(block);
      } else if (block.type === 'exercise') {
        exercises.push(block);
      } else if (block.type === 'callout' && block.variant === 'form_tip') {
        tips.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      timerBlocks: timers,
      exerciseBlocks: exercises,
      tipBlocks: tips,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [section.content]);

  const hasTimers = timerBlocks.length > 0;
  const hasExercises = exerciseBlocks.length > 0;
  const hasTips = tipBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasTimers && !hasExercises && !hasTips && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Workout Timer Section - Interactive timer at the top */}
      {hasTimers && (
        <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-lg p-4 border border-rose-200/50 dark:border-rose-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300 mb-3">
            <Timer className="h-4 w-4" aria-hidden="true" />
            <span>Workout Timer</span>
          </h4>
          <ContentBlocks
            blocks={timerBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Main content (non-categorized blocks) */}
      {hasOtherBlocks && (
        <ContentBlocks
          blocks={otherBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Exercise List Section */}
      {hasExercises && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200/50 dark:border-emerald-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-3">
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            <span>Exercises</span>
          </h4>
          <ContentBlocks
            blocks={exerciseBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Timestamps for Exercise Demonstrations */}
      {hasTimestamps && (
        <div className="mt-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Exercise Demos</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            <ContentBlocks
              blocks={timestampBlocks}
              onPlay={onPlay}
              onStop={onStop}
              isVideoActive={isVideoActive}
              activeStartSeconds={activeStartSeconds}
            />
          </div>
        </div>
      )}

      {/* Form Tips */}
      {hasTips && (
        <div className="mt-4 space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400 mb-2">
            <Heart className="h-4 w-4" aria-hidden="true" />
            <span>Form Tips</span>
          </h4>
          <ContentBlocks
            blocks={tipBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}
    </div>
  );
});
