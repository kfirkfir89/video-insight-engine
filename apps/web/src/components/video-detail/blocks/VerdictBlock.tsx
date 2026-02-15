import { memo } from 'react';
import { ThumbsUp, ThumbsDown, HelpCircle, Minus, Users, UserX, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { VerdictBlock as VerdictBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface VerdictBlockProps {
  block: VerdictBlockType;
}

const VERDICT_CONFIG = {
  recommended: {
    icon: ThumbsUp,
    label: BLOCK_LABELS.recommended,
    bgClass: 'bg-success/[0.03]',
    iconClass: 'text-success',
  },
  not_recommended: {
    icon: ThumbsDown,
    label: BLOCK_LABELS.notRecommended,
    bgClass: 'bg-destructive/[0.03]',
    iconClass: 'text-destructive',
  },
  conditional: {
    icon: HelpCircle,
    label: BLOCK_LABELS.conditional,
    bgClass: 'bg-warning/[0.03]',
    iconClass: 'text-warning',
  },
  neutral: {
    icon: Minus,
    label: BLOCK_LABELS.neutral,
    bgClass: 'bg-muted/[0.03]',
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
      variant="transparent"
    >
      <div className="block-label-minimal">
        <Award className="h-3 w-3" aria-hidden="true" />
        <span>{BLOCK_LABELS.verdict}</span>
      </div>
      <div className={cn('rounded-lg p-4 space-y-3', config.bgClass)}>
        {/* Verdict badge */}
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.iconClass)} aria-hidden="true" style={{ animation: 'breathe 3s ease-in-out infinite' }} />
          <span className={cn('text-sm font-medium', config.iconClass)}>{config.label}</span>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground"><ConceptHighlighter text={summary} /></p>

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
                      <ConceptHighlighter text={item} />
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
                      <ConceptHighlighter text={item} />
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
