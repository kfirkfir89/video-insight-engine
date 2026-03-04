import { memo, useMemo, type ReactNode } from 'react';
import { Dumbbell, UtensilsCrossed, BarChart3, Timer, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { TimerView } from '../containers/TimerView';
import { ViewLayout, LayoutSection, sidebarMainOrFallback, renderSections } from './ViewLayout';

interface FitnessViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const FITNESS_RULES: readonly BlockGroupRule[] = [
  { name: 'timers', match: (b) => b.type === 'workout_timer' },
  { name: 'exercises', match: (b) => b.type === 'exercise' },
  { name: 'nutrition', match: (b) => b.type === 'nutrition' },
  { name: 'stats', match: (b) => b.type === 'statistic' },
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'form_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for fitness/workout content.
 * Wraps exercises in TimerView when workout_timer blocks exist.
 * Layout: TimerView (exercises), sidebar (nutrition/stats), tips/timestamps below.
 */
export const FitnessView = memo(function FitnessView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: FitnessViewProps) {
  const groups = useGroupedBlocks(chapter.content, FITNESS_RULES);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  // Extract timer duration from workout_timer blocks
  const timerDuration = useMemo(() => {
    const timerBlock = groups.timers[0];
    if (timerBlock && 'duration' in timerBlock && typeof timerBlock.duration === 'number') {
      return timerBlock.duration;
    }
    return null;
  }, [groups.timers]);

  const sections: { key: string; node: ReactNode }[] = [];

  const hasExercises = groups.exercises.length > 0;
  const hasOther = groups.other.length > 0;

  // Exercises wrapped in TimerView when timer data available
  if (hasExercises && timerDuration) {
    sections.push({ key: 'exercises-timer', node: (
      <LayoutSection icon={Dumbbell} label="Workout">
        <TimerView durationSeconds={timerDuration} label="Exercise Timer">
          <ContentBlocks blocks={groups.exercises} {...blockProps} />
        </TimerView>
      </LayoutSection>
    )});
  } else if (hasExercises) {
    // No timer data — show timer blocks separately, exercises normally
    if (groups.timers.length > 0) {
      sections.push({ key: 'timers', node: (
        <LayoutSection icon={Timer} label="Timers">
          <ContentBlocks blocks={groups.timers} {...blockProps} />
        </LayoutSection>
      )});
    }
    sections.push({ key: 'exercises', node: (
      <LayoutSection icon={Dumbbell} label="Exercises">
        <ContentBlocks blocks={groups.exercises} {...blockProps} />
      </LayoutSection>
    )});
  } else if (groups.timers.length > 0) {
    sections.push({ key: 'timers', node: (
      <LayoutSection icon={Timer} label="Timers">
        <ContentBlocks blocks={groups.timers} {...blockProps} />
      </LayoutSection>
    )});
  }

  // Sidebar: nutrition + stats + other
  const hasSidebar = groups.nutrition.length > 0 || groups.stats.length > 0;

  const fallback: { key: string; node: ReactNode }[] = [];
  if (hasOther) fallback.push({ key: 'other', node: (
    <ContentBlocks blocks={groups.other} {...blockProps} />
  )});
  if (groups.nutrition.length > 0) fallback.push({ key: 'nutrition', node: (
    <LayoutSection icon={UtensilsCrossed} label="Nutrition">
      <ContentBlocks blocks={groups.nutrition} {...blockProps} />
    </LayoutSection>
  )});
  if (groups.stats.length > 0) fallback.push({ key: 'stats', node: (
    <LayoutSection icon={BarChart3} label="Stats">
      <ContentBlocks blocks={groups.stats} {...blockProps} />
    </LayoutSection>
  )});

  if (hasSidebar || hasOther) {
    sections.push(...sidebarMainOrFallback(
      hasSidebar ? (
        <>
          {groups.nutrition.length > 0 && (
            <LayoutSection icon={UtensilsCrossed} label="Nutrition">
              <ContentBlocks blocks={groups.nutrition} {...blockProps} />
            </LayoutSection>
          )}
          {groups.stats.length > 0 && (
            <div className={groups.nutrition.length > 0 ? 'mt-6' : ''}>
              <LayoutSection icon={BarChart3} label="Stats">
                <ContentBlocks blocks={groups.stats} {...blockProps} />
              </LayoutSection>
            </div>
          )}
        </>
      ) : null,
      hasOther ? (
        <ContentBlocks blocks={groups.other} {...blockProps} />
      ) : null,
      fallback,
    ));
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <ContentBlocks blocks={groups.tips} {...blockProps} />
    )});
  }

  if (groups.timestamps.length > 0) {
    sections.push({ key: 'timestamps', node: (
      <LayoutSection icon={Clock} label="Timestamps">
        <div className="flex flex-wrap gap-2">
          <ContentBlocks blocks={groups.timestamps} {...blockProps} />
        </div>
      </LayoutSection>
    )});
  }

  if (sections.length === 0) return null;

  return (
    <ViewLayout>
      {renderSections(sections)}
    </ViewLayout>
  );
});
