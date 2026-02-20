import { Fragment, memo, type ReactNode } from 'react';
import { Dumbbell, UtensilsCrossed, Timer, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

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
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'form_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for fitness/workout content.
 * Emphasizes:
 * - Workout timer at the top
 * - Exercise list with reps/sets
 * - Nutrition info
 * - Form tips and callouts
 * - Video timestamps for demonstrations
 */
export const FitnessView = memo(function FitnessView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: FitnessViewProps) {
  const groups = useGroupedBlocks(chapter.content, FITNESS_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.timers.length > 0) {
    sections.push({ key: 'timers', node: (
      <div className="space-y-2">
        <SectionHeader icon={Timer} label="Timers" />
        <ContentBlocks blocks={groups.timers} {...blockProps} />
      </div>
    )});
  }

  if (groups.exercises.length > 0) {
    sections.push({ key: 'exercises', node: (
      <div className="space-y-2">
        <SectionHeader icon={Dumbbell} label="Exercises" />
        <ContentBlocks blocks={groups.exercises} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.nutrition.length > 0) {
    sections.push({ key: 'nutrition', node: (
      <div className="space-y-2">
        <SectionHeader icon={UtensilsCrossed} label="Nutrition" />
        <ContentBlocks blocks={groups.nutrition} {...blockProps} />
      </div>
    )});
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <ContentBlocks blocks={groups.tips} {...blockProps} />
    )});
  }

  if (groups.timestamps.length > 0) {
    sections.push({ key: 'timestamps', node: (
      <div className="space-y-2">
        <SectionHeader icon={Clock} label="Timestamps" />
        <div className="flex flex-wrap gap-2">
          <ContentBlocks blocks={groups.timestamps} {...blockProps} />
        </div>
      </div>
    )});
  }

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <Fragment key={section.key}>
          {i > 0 && <div className="fade-divider" />}
          {section.node}
        </Fragment>
      ))}
    </div>
  );
});
