import { memo, useMemo } from 'react';
import { UtensilsCrossed, ListOrdered, Apple, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { TabbedView } from '../containers/TabbedView';
import { ViewLayout, LayoutSection, renderSections } from './ViewLayout';

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
 * Uses TabbedView: Ingredients | Steps | Nutrition tabs.
 * Tips and timestamps shown below the tabs.
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
    [groups.recipeInfo, groups.ingredients],
  );

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  // Build tabbed sections
  const tabs = useMemo(() => {
    const result = [];

    if (ingredientBlocks.length > 0) {
      result.push({
        id: 'ingredients',
        label: 'Ingredients',
        icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
        content: <ContentBlocks blocks={ingredientBlocks} {...blockProps} />,
      });
    }

    if (groups.steps.length > 0) {
      result.push({
        id: 'steps',
        label: 'Steps',
        icon: <ListOrdered className="h-3.5 w-3.5" />,
        content: <ContentBlocks blocks={groups.steps} {...blockProps} />,
      });
    }

    if (groups.nutrition.length > 0) {
      result.push({
        id: 'nutrition',
        label: 'Nutrition',
        icon: <Apple className="h-3.5 w-3.5" />,
        content: <ContentBlocks blocks={groups.nutrition} {...blockProps} />,
      });
    }

    // If we have "other" blocks, add them as a general tab
    if (groups.other.length > 0) {
      result.push({
        id: 'overview',
        label: 'Overview',
        content: <ContentBlocks blocks={groups.other} {...blockProps} />,
      });
    }

    return result;
  }, [ingredientBlocks, groups.steps, groups.nutrition, groups.other, blockProps]);

  // Below-tabs sections
  const belowSections = useMemo(() => {
    const sections: { key: string; node: React.ReactNode }[] = [];
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
    return sections;
  }, [groups.tips, groups.timestamps, blockProps]);

  if (tabs.length === 0 && belowSections.length === 0) return null;

  return (
    <ViewLayout>
      {tabs.length > 0 && <TabbedView tabs={tabs} />}
      {renderSections(belowSections)}
    </ViewLayout>
  );
});
