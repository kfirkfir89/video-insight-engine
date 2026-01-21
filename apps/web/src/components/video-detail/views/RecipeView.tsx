import { memo, useMemo } from 'react';
import { ChefHat, ListChecks, Clock, Lightbulb } from 'lucide-react';
import type { Section, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface RecipeViewProps {
  section: Section;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for recipe/cooking content.
 * Emphasizes:
 * - Ingredients lists at the top
 * - Numbered cooking steps
 * - Chef tips and callouts
 * - Timestamps for technique demonstrations
 */
export const RecipeView = memo(function RecipeView({
  section,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: RecipeViewProps) {
  // Group blocks by type for recipe-optimized layout
  const { ingredientBlocks, stepBlocks, tipBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const recipeInfo: ContentBlock[] = [];
    const ingredients: ContentBlock[] = [];
    const steps: ContentBlock[] = [];
    const tips: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of section.content ?? []) {
      if (block.type === 'bullets' && block.variant === 'ingredients') {
        ingredients.push(block);
      } else if (block.type === 'numbered' && block.variant === 'cooking_steps') {
        steps.push(block);
      } else if (block.type === 'callout' && block.variant === 'chef_tip') {
        tips.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else if (block.type === 'keyvalue' && block.variant === 'info') {
        // Recipe info (prep time, servings, etc.) collected separately
        recipeInfo.push(block);
      } else {
        other.push(block);
      }
    }

    // Combine info blocks at top with ingredients (O(1) spread vs O(n) unshift)
    return {
      ingredientBlocks: [...recipeInfo, ...ingredients],
      stepBlocks: steps,
      tipBlocks: tips,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [section.content]);

  const hasIngredients = ingredientBlocks.length > 0;
  const hasSteps = stepBlocks.length > 0;
  const hasTips = tipBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content to avoid rendering empty wrapper
  if (!hasIngredients && !hasSteps && !hasTips && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Ingredients Section - Always at top for recipes */}
      {hasIngredients && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200/50 dark:border-amber-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 mb-3">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            <span>Ingredients</span>
          </h4>
          <ContentBlocks
            blocks={ingredientBlocks}
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

      {/* Cooking Steps Section */}
      {hasSteps && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200/50 dark:border-emerald-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-3">
            <ChefHat className="h-4 w-4" aria-hidden="true" />
            <span>Cooking Steps</span>
          </h4>
          <ContentBlocks
            blocks={stepBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Timestamps for Techniques */}
      {hasTimestamps && (
        <div className="mt-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Key Moments</span>
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

      {/* Chef Tips */}
      {hasTips && (
        <div className="mt-4 space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>Chef Tips</span>
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
