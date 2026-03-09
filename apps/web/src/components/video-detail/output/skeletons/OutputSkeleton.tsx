import type { OutputSection, OutputType } from '@vie/types';
import type { StreamState } from '../../../../hooks/use-summary-stream';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface OutputSkeletonProps {
  outputType: OutputType;
  sections: OutputSection[];
  streamingState?: StreamState;
}

export function OutputSkeleton({ sections, streamingState }: OutputSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 animate-[fadeUp_0.3s_ease_both]">
      {/* Tab bar skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((s) => (
          <div
            key={s.id}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted/50 px-4 py-2"
          >
            <span className="text-sm">{s.emoji}</span>
            <span className="text-sm text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <GlassCard key={i} className={cn('animate-pulse', i <= 1 && 'opacity-100', i > 1 && 'opacity-60')}>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted/60" />
              <div className="h-3 w-4/5 rounded bg-muted/40" />
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Progress indicator */}
      {streamingState?.phase && streamingState.phase !== 'done' && (
        <p className="text-center text-xs text-muted-foreground animate-pulse">
          Processing... {streamingState.phase.replace('_', ' ')}
        </p>
      )}
    </div>
  );
}
