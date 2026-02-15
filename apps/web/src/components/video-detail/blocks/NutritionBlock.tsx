import { memo } from 'react';
import { Apple } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { NutritionBlock as NutritionBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface NutritionBlockProps {
  block: NutritionBlockType;
}

/**
 * Renders nutrition facts in a table layout.
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
        <p className="text-xs text-muted-foreground/60 mb-2">
          {BLOCK_LABELS.perServing}: {block.servingSize}
        </p>
      )}

      <table className="w-full text-sm table-fade-dividers">
        <thead className="sr-only">
          <tr>
            <th>Nutrient</th>
            <th>Amount</th>
            <th>Daily Value</th>
          </tr>
        </thead>
        <tbody className="stagger-children">
          {items.map((item, index) => (
            <tr key={index} className="even:bg-muted/[0.08] hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2 text-muted-foreground">{item.nutrient}</td>
              <td className="px-4 py-2 font-medium text-right tabular-nums">
                {item.amount}
                {item.unit && <span className="text-muted-foreground ml-0.5">{item.unit}</span>}
              </td>
              {item.dailyValue && (
                <td className="px-4 py-2 text-muted-foreground/70 text-right text-xs tabular-nums">
                  {item.dailyValue}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </BlockWrapper>
  );
});
