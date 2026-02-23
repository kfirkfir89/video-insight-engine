import { memo, useMemo, type ReactNode } from 'react';
import { UtensilsCrossed, ListOrdered, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ViewLayout, LayoutSection, sidebarMainOrFallback, renderSections } from './ViewLayout';

interface RecipeViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const RECIPE_RULES: readonly BlockGroupRule[] = [
  { name: 'ingredients', match: (b) => b.type === 'ingredient' || (b.type === 'bullets' && b.variant === 'ingredients') },
  { name: 'steps', match: (b) => b.type === 'step' || (b.type === 'numbered' && b.variant === 'cooking_steps') },
  { name: 'nutrition', match: (b) => b.type === 'nutrition' },
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'chef_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
  { name: 'recipeInfo', match: (b) => b.type === 'keyvalue' && b.variant === 'info' },
];

/**
 * Specialized view for recipe/cooking content.
 * Layout: sidebar (ingredients/info) + main (steps), full-width tips/timestamps below.
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
    () => [...groups.recipeInfo, ...groups.ingredients, ...groups.nutrition],
    [groups.recipeInfo, groups.ingredients, groups.nutrition],
  );

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  const hasSidebar = ingredientBlocks.length > 0;
  const hasSteps = groups.steps.length > 0;
  const hasOther = groups.other.length > 0;

  const fallback: { key: string; node: ReactNode }[] = [];
  if (hasSidebar) fallback.push({ key: 'ingredients', node: (
    <LayoutSection icon={UtensilsCrossed} label="Ingredients">
      <ContentBlocks blocks={ingredientBlocks} {...blockProps} />
    </LayoutSection>
  )});
  if (hasOther) fallback.push({ key: 'other', node: (
    <ContentBlocks blocks={groups.other} {...blockProps} />
  )});
  if (hasSteps) fallback.push({ key: 'steps', node: (
    <LayoutSection icon={ListOrdered} label="Steps">
      <ContentBlocks blocks={groups.steps} {...blockProps} />
    </LayoutSection>
  )});

  sections.push(...sidebarMainOrFallback(
    hasSidebar ? (
      <LayoutSection icon={UtensilsCrossed} label="Ingredients">
        <ContentBlocks blocks={ingredientBlocks} {...blockProps} />
      </LayoutSection>
    ) : null,
    (hasSteps || hasOther) ? (
      <>
        {hasSteps && (
          <LayoutSection icon={ListOrdered} label="Steps">
            <ContentBlocks blocks={groups.steps} {...blockProps} />
          </LayoutSection>
        )}
        {hasOther && (
          <div className={hasSteps ? 'mt-6' : ''}>
            <ContentBlocks blocks={groups.other} {...blockProps} />
          </div>
        )}
      </>
    ) : null,
    fallback,
  ));

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <LayoutSection icon={Lightbulb} label="Tips">
        <ContentBlocks blocks={groups.tips} {...blockProps} />
      </LayoutSection>
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
