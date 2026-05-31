import { memo } from 'react';
import { Play } from 'lucide-react';

import { Badge } from './Badge';
import { cn } from '@/lib/utils';

export interface VisualEvidenceProps {
  /** Frame thumbnail URL (signed S3 link). */
  thumbnailUrl?: string;
  /** One-line vision-LLM caption describing what's on screen. */
  caption?: string;
  /** On-screen text (OCR or vision-read) — rendered as mono pull-quote. */
  ocr?: string;
  /** Scene type tag — "slide", "code", "diagram", "demo", etc. */
  sceneType?: string;
  /** Vision-LLM rationale for why this frame supports the row. */
  evidence?: string;
  /** When set + onSeek provided, renders a jump-to-timestamp button. */
  timestamp?: number;
  /** Seek callback. */
  onSeek?: (seconds: number) => void;
  /** Layout: `compact` is a tight 96×54 thumbnail row; `figure` is full-width 16:9. */
  variant?: 'compact' | 'figure';
  /** Extra classes for the outer container. */
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Frame-evidence slot — renders the vision/OCR metadata attached by the
 * pipeline's `inject_frame_thumbnails`. Returns `null` when there is no
 * thumbnail AND no caption AND no OCR, so consumers can drop it unguarded.
 *
 * Used by MomentTrack (expanded view), StepByStepInteractive (figure column),
 * SpotExplorer (cards), and every new frame-aware component.
 */
export const VisualEvidence = memo(function VisualEvidence({
  thumbnailUrl,
  caption,
  ocr,
  sceneType,
  evidence,
  timestamp,
  onSeek,
  variant = 'compact',
  className,
}: VisualEvidenceProps) {
  const hasContent = Boolean(thumbnailUrl || caption || ocr);
  if (!hasContent) return null;

  const sceneLabel = sceneType?.replace(/_/g, ' ');
  const canSeek = typeof timestamp === 'number' && onSeek != null;

  if (variant === 'figure') {
    return (
      <figure
        data-slot="visual-evidence"
        data-variant="figure"
        className={cn('flex flex-col gap-2', className)}
      >
        {thumbnailUrl && (
          <div className="relative overflow-hidden rounded-lg border border-border/40 bg-muted/20 aspect-video">
            <img
              src={thumbnailUrl}
              alt={caption || 'Frame from video'}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {sceneLabel && (
              <Badge
                variant="muted"
                className="absolute top-2 start-2 text-[10px] font-medium capitalize backdrop-blur"
              >
                {sceneLabel}
              </Badge>
            )}
            {canSeek && (
              <button
                type="button"
                onClick={() => onSeek!(timestamp!)}
                aria-label={`Jump to ${formatTimestamp(timestamp!)}`}
                className={cn(
                  'absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-md',
                  'bg-background/80 px-2 py-1 text-xs font-mono tabular-nums text-primary',
                  'backdrop-blur transition-colors hover:bg-background',
                )}
                dir="ltr"
              >
                <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                {formatTimestamp(timestamp!)}
              </button>
            )}
          </div>
        )}
        {(caption || ocr || evidence) && (
          <figcaption className="space-y-1">
            {caption && (
              <p className="text-sm leading-snug text-foreground/90">{caption}</p>
            )}
            {ocr && (
              <p className="text-xs leading-snug text-muted-foreground font-mono break-words">
                &ldquo;{ocr}&rdquo;
              </p>
            )}
            {evidence && (
              <p className="text-xs italic leading-snug text-muted-foreground/80">
                {evidence}
              </p>
            )}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <div
      data-slot="visual-evidence"
      data-variant="compact"
      className={cn(
        'rounded-md border border-border/40 bg-muted/15 px-3 py-2 space-y-1.5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">
          On screen
        </span>
        {sceneLabel && (
          <Badge variant="muted" className="text-[10px] font-medium capitalize">
            {sceneLabel}
          </Badge>
        )}
        {canSeek && (
          <button
            type="button"
            onClick={() => onSeek!(timestamp!)}
            aria-label={`Jump to ${formatTimestamp(timestamp!)}`}
            className={cn(
              'ms-auto inline-flex items-center gap-1 rounded-md',
              'bg-primary/10 px-2 py-0.5 text-xs font-mono tabular-nums text-primary',
              'transition-colors hover:bg-primary/20',
            )}
            dir="ltr"
          >
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            {formatTimestamp(timestamp!)}
          </button>
        )}
      </div>

      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={caption || 'Frame'}
          loading="lazy"
          className="w-full max-w-[240px] rounded border border-border/30 object-cover aspect-video"
        />
      )}

      {caption && (
        <p className="text-sm leading-snug text-foreground/90">{caption}</p>
      )}
      {ocr && (
        <p className="text-xs leading-snug text-muted-foreground font-mono break-words">
          &ldquo;{ocr}&rdquo;
        </p>
      )}
      {evidence && (
        <p className="text-xs italic leading-snug text-muted-foreground/80">
          {evidence}
        </p>
      )}
    </div>
  );
});
