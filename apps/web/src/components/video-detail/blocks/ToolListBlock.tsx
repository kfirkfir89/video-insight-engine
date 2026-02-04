import { memo, useState } from 'react';
import { Wrench, Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { ToolListBlock as ToolListBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ToolListBlockProps {
  block: ToolListBlockType;
}

/**
 * Renders an equipment/tool list with optional checkbox tracking.
 */
export const ToolListBlock = memo(function ToolListBlock({ block }: ToolListBlockProps) {
  const tools = block.tools ?? [];
  const [checkedTools, setCheckedTools] = useState<Set<number>>(new Set());

  if (tools.length === 0) return null;

  const toggleTool = (index: number) => {
    setCheckedTools(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.tools}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{BLOCK_LABELS.tools}</span>
        </div>
        <ul className="space-y-1.5" role="list">
          {tools.map((tool, index) => {
            const isChecked = checkedTools.has(index) || tool.checked;
            return (
              <li key={index} className="flex items-start gap-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => toggleTool(index)}
                  className={cn(
                    'shrink-0 mt-0.5 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded'
                  )}
                  aria-label={isChecked ? `Uncheck ${tool.name}` : `Check ${tool.name}`}
                >
                  {isChecked ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </button>
                <div className={cn('flex-1', isChecked && 'line-through text-muted-foreground/50')}>
                  <span className="font-medium">{tool.name}</span>
                  {tool.quantity && (
                    <span className="text-muted-foreground"> — {tool.quantity}</span>
                  )}
                  {tool.notes && (
                    <span className="text-xs text-muted-foreground/70 ml-1">({tool.notes})</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </BlockWrapper>
  );
});
