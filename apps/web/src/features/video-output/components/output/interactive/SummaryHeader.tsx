import { memo } from 'react';
import { cn } from '@/lib/utils';

interface SummaryHeaderProps {
  summary: string;
  title?: string;
  emoji?: string;
  className?: string;
}

/**
 * SummaryHeader — a one-line orientation banner placed on top of a dense tab so
 * the reader knows what the long list below distils to. Secondary-tier
 * (attachment-only). Opaque card, full border (Glass-Is-Rare); no gradient,
 * no side-stripe.
 */
export const SummaryHeader = memo(function SummaryHeader({
  summary,
  title,
  emoji,
  className,
}: SummaryHeaderProps) {
  if (!summary?.trim()) return null;
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3',
        className,
      )}
      role="note"
    >
      {emoji ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg leading-none">
          {emoji}
        </span>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {title ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            {title}
          </span>
        ) : null}
        <p className="text-sm leading-snug text-foreground">{summary}</p>
      </div>
    </div>
  );
});
