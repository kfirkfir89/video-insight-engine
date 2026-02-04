import { memo } from 'react';
import { ThumbsUp, ThumbsDown, HelpCircle, Minus, Users, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { VerdictBlock as VerdictBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface VerdictBlockProps {
  block: VerdictBlockType;
}

const VERDICT_CONFIG = {
  recommended: {
    icon: ThumbsUp,
    label: BLOCK_LABELS.recommended,
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  not_recommended: {
    icon: ThumbsDown,
    label: BLOCK_LABELS.notRecommended,
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    iconClass: 'text-rose-600 dark:text-rose-400',
  },
  conditional: {
    icon: HelpCircle,
    label: BLOCK_LABELS.conditional,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  neutral: {
    icon: Minus,
    label: BLOCK_LABELS.neutral,
    bgClass: 'bg-muted/50',
    borderClass: 'border-border/50',
    iconClass: 'text-muted-foreground',
  },
};

/**
 * Renders a verdict/recommendation card.
 */
export const VerdictBlock = memo(function VerdictBlock({ block }: VerdictBlockProps) {
  const { verdict, summary, bestFor, notFor } = block;

  if (!summary) return null;

  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.neutral;
  const Icon = config.icon;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={`${BLOCK_LABELS.verdict}: ${config.label}`}
    >
      <div className={cn('rounded-lg border p-4 space-y-3', config.bgClass, config.borderClass)}>
        {/* Verdict badge */}
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.iconClass)} aria-hidden="true" />
          <span className={cn('text-sm font-medium', config.iconClass)}>{config.label}</span>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground">{summary}</p>

        {/* Best for / Not for */}
        {(bestFor?.length || notFor?.length) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/30">
            {bestFor && bestFor.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{BLOCK_LABELS.bestFor}</span>
                </div>
                <ul className="space-y-0.5">
                  {bestFor.map((item, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-baseline gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0 translate-y-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notFor && notFor.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5">
                  <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{BLOCK_LABELS.notFor}</span>
                </div>
                <ul className="space-y-0.5">
                  {notFor.map((item, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-baseline gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-rose-500/60 shrink-0 translate-y-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
