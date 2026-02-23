import { memo, type ReactNode } from 'react';
import { Dumbbell, UtensilsCrossed, BarChart3, Timer, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { ViewLayout, LayoutSection, buildPairedSection, renderSections } from './ViewLayout';

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
 * Layout: sidebar (nutrition/stats) + main (exercises), timers/tips full-width below.
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

  // Timers at top (full-width)
  if (groups.timers.length > 0) {
    sections.push({ key: 'timers', node: (
      <LayoutSection icon={Timer} label="Timers">
        <ContentBlocks blocks={groups.timers} {...blockProps} />
      </LayoutSection>
    )});
  }

  // Top row: sidebar (nutrition + stats) + main (exercises)
  const sidebarBlocks = [...groups.nutrition, ...groups.stats];
  const hasSidebar = sidebarBlocks.length > 0;
  const hasExercises = groups.exercises.length > 0;

  if (hasSidebar && hasExercises) {
    sections.push(buildPairedSection(
      { width: 'sidebar', node: (
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
      )},
      { width: 'main', node: (
        <>
          <LayoutSection icon={Dumbbell} label="Exercises">
            <ContentBlocks blocks={groups.exercises} {...blockProps} />
          </LayoutSection>
          {groups.other.length > 0 && (
            <div className="mt-6">
              <ContentBlocks blocks={groups.other} {...blockProps} />
            </div>
          )}
        </>
      )},
    ));
  } else {
    if (hasExercises) {
      sections.push({ key: 'exercises', node: (
        <LayoutSection icon={Dumbbell} label="Exercises">
          <ContentBlocks blocks={groups.exercises} {...blockProps} />
        </LayoutSection>
      )});
    }

    if (groups.other.length > 0) {
      sections.push({ key: 'other', node: (
        <ContentBlocks blocks={groups.other} {...blockProps} />
      )});
    }

    if (groups.nutrition.length > 0) {
      sections.push({ key: 'nutrition', node: (
        <LayoutSection icon={UtensilsCrossed} label="Nutrition">
          <ContentBlocks blocks={groups.nutrition} {...blockProps} />
        </LayoutSection>
      )});
    }

    if (groups.stats.length > 0) {
      sections.push({ key: 'stats', node: (
        <LayoutSection icon={BarChart3} label="Stats">
          <ContentBlocks blocks={groups.stats} {...blockProps} />
        </LayoutSection>
      )});
    }
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
