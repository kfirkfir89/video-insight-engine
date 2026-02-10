import { memo } from 'react';
import { ThumbsUp, ThumbsDown, HelpCircle, Minus, Users, UserX, Scale } from 'lucide-react';
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
    bgClass: 'bg-success/[0.06]',
    borderClass: 'border-success/30',
    iconClass: 'text-success',
    glowClass: 'glow-success',
  },
  not_recommended: {
    icon: ThumbsDown,
    label: BLOCK_LABELS.notRecommended,
    bgClass: 'bg-destructive/[0.06]',
    borderClass: 'border-destructive/30',
    iconClass: 'text-destructive',
    glowClass: 'glow-destructive',
  },
  conditional: {
    icon: HelpCircle,
    label: BLOCK_LABELS.conditional,
    bgClass: 'bg-warning/[0.06]',
    borderClass: 'border-warning/30',
    iconClass: 'text-warning',
    glowClass: 'glow-warning',
  },
  neutral: {
    icon: Minus,
    label: BLOCK_LABELS.neutral,
    bgClass: 'bg-muted/[0.06]',
    borderClass: 'border-border/50',
    iconClass: 'text-muted-foreground',
    glowClass: '',
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
      variant="card"
      headerIcon={<Scale className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.verdict}
    >
      <div className={cn('rounded-lg border p-4 space-y-3', config.bgClass, config.borderClass, config.glowClass)}>
        {/* Verdict badge */}
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.iconClass)} aria-hidden="true" style={{ animation: 'breathe 3s ease-in-out infinite' }} />
          <span className={cn('text-sm font-medium', config.iconClass)}>{config.label}</span>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground">{summary}</p>

        {/* Best for / Not for */}
        {(bestFor?.length || notFor?.length) && (
          <>
            <div className="fade-divider" aria-hidden="true" />
          </>
        )}
        {(bestFor?.length || notFor?.length) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {bestFor && bestFor.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-success mb-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{BLOCK_LABELS.bestFor}</span>
                </div>
                <ul className="space-y-0.5 stagger-children">
                  {bestFor.map((item, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-baseline gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-success/60 shrink-0 translate-y-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notFor && notFor.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mb-1.5">
                  <UserX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{BLOCK_LABELS.notFor}</span>
                </div>
                <ul className="space-y-0.5 stagger-children">
                  {notFor.map((item, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-baseline gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-destructive/60 shrink-0 translate-y-1" />
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
