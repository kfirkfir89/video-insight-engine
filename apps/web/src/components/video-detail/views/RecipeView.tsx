import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { UtensilsCrossed, ListOrdered, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

interface RecipeViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const RECIPE_RULES: readonly BlockGroupRule[] = [
  { name: 'ingredients', match: (b) => b.type === 'bullets' && b.variant === 'ingredients' },
  { name: 'steps', match: (b) => b.type === 'numbered' && b.variant === 'cooking_steps' },
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'chef_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
  { name: 'recipeInfo', match: (b) => b.type === 'keyvalue' && b.variant === 'info' },
];

/**
 * Specialized view for recipe/cooking content.
 * Emphasizes:
 * - Ingredients lists at the top
 * - Numbered cooking steps
 * - Chef tips and callouts
 * - Timestamps for technique demonstrations
 */
export const RecipeView = memo(function RecipeView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: RecipeViewProps) {
  const groups = useGroupedBlocks(chapter.content, RECIPE_RULES);

  const ingredientBlocks = useMemo(
    () => [...groups.recipeInfo, ...groups.ingredients],
    [groups.recipeInfo, groups.ingredients]
  );

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (ingredientBlocks.length > 0) {
    sections.push({ key: 'ingredients', node: (
      <div className="space-y-2">
        <SectionHeader icon={UtensilsCrossed} label="Ingredients" />
        <ContentBlocks blocks={ingredientBlocks} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.steps.length > 0) {
    sections.push({ key: 'steps', node: (
      <div className="space-y-2">
        <SectionHeader icon={ListOrdered} label="Steps" />
        <ContentBlocks blocks={groups.steps} {...blockProps} />
      </div>
    )});
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <div className="space-y-2">
        <SectionHeader icon={Lightbulb} label="Tips" />
        <ContentBlocks blocks={groups.tips} {...blockProps} />
      </div>
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
