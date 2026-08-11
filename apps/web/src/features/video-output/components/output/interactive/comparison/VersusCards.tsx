import { cn } from '@/lib/utils';
import { GlassCard, FadeIn, Badge, EmojiMarker } from '@/components/vie';

import type { ComparisonRow } from './types';

interface VersusCardsProps {
  comparisons: ComparisonRow[];
  colLeft: string;
  colRight: string;
}

/** Feature comparison — versus (side-by-side cards) mode. */
export function VersusCards({ comparisons, colLeft, colRight }: VersusCardsProps) {
  return (
    <div className="space-y-2">
      {comparisons.map((item, index) => (
        <FadeIn key={index} index={index}>
          <GlassCard variant="outlined" className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.feature}</p>
              {item.winner && item.winner !== 'tie' && (
                <Badge variant="success" className="text-xs font-semibold">
                  {item.winner === 'left' ? colLeft : colRight} wins
                </Badge>
              )}
              {item.winner === 'tie' && <Badge variant="muted" className="text-xs font-medium">Tie</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className={cn(
                'rounded-md p-2 relative',
                item.winner === 'left' ? 'bg-success/10 border border-success/20' : 'bg-muted/20',
                item.winner === 'right' && 'opacity-60',
              )}>
                {item.winner === 'left' && (
                  <EmojiMarker emoji="🏆" size="sm" animated={false} className="absolute -top-2 -end-1" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--vie-accent)]">{colLeft}</span>
                <p className="text-sm leading-relaxed text-muted-foreground mt-1">{item.thisProduct}</p>
              </div>
              <div className={cn(
                'rounded-md p-2 relative',
                item.winner === 'right' ? 'bg-success/10 border border-success/20' : 'bg-muted/20',
                item.winner === 'left' && 'opacity-60',
              )}>
                {item.winner === 'right' && (
                  <EmojiMarker emoji="🏆" size="sm" animated={false} className="absolute -top-2 -end-1" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider">{colRight}</span>
                <p className="text-sm leading-relaxed text-muted-foreground mt-1">{item.competitor}</p>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      ))}
    </div>
  );
}
