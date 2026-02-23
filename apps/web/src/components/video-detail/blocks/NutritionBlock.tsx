import { memo } from 'react';
import { Apple } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { NutritionBlock as NutritionBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface NutritionBlockProps {
  block: NutritionBlockType;
}

/**
 * Renders nutrition facts in a list layout with fade-dividers.
 */
export const NutritionBlock = memo(function NutritionBlock({ block }: NutritionBlockProps) {
  const items = block.items ?? [];

  if (items.length === 0) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.nutrition}
      variant="transparent"
    >
      <div className="block-label-minimal">
        <Apple className="h-3 w-3" aria-hidden="true" />
        <span>{BLOCK_LABELS.nutrition}</span>
      </div>
      {block.servingSize && (
        <p className="text-xs text-muted-foreground/70 mb-2">
          {BLOCK_LABELS.perServing}: {block.servingSize}
        </p>
      )}

      <div className="stagger-children" role="list" aria-label="Nutrition facts">
        {items.map((item, index) => (
          <div key={index}>
            {index > 0 && <div className="fade-divider my-1" aria-hidden="true" />}
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 transition-colors" role="listitem">
              <span className="text-muted-foreground flex-1 min-w-0 truncate">{item.nutrient}</span>
              <span className="font-medium text-right tabular-nums shrink-0">
                {item.amount}
                {item.unit && <span className="text-muted-foreground ml-0.5">{item.unit}</span>}
              </span>
              {item.dailyValue && (
                <span className="text-muted-foreground/70 text-right text-xs tabular-nums w-10 shrink-0">
                  {item.dailyValue}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </BlockWrapper>
  );
});
