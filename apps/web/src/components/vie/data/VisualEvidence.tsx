import { memo, useState } from 'react';
import { ImageOff, Play } from 'lucide-react';

import { Badge } from './Badge';
import { Skeleton } from '@/components/ui/skeleton';
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

export interface EvidenceImageProps {
  src: string;
  alt: string;
  /** Extra classes for the `<img>` element. */
  imgClassName?: string;
  /** Extra classes for the `relative aspect-video` wrapper. */
  className?: string;
  /** Overlay nodes (scene badge, seek button) rendered above the image. */
  children?: React.ReactNode;
}

/**
 * Lazy thumbnail with a 16:9 skeleton placeholder that mirrors the final
 * layout (no CLS) and resolves on load OR error so a broken signed-S3 URL
 * never skeletons forever. A failed load retries once (remounting the img —
 * presigned S3 URLs reject extra query params, so no cache-bust suffix),
 * then renders a slim "Frame unavailable" chip so the failure stays visible
 * instead of the slot silently vanishing.
 */
export function EvidenceImage({ src, alt, imgClassName, className, children }: EvidenceImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);

  // Reset load/error state when the source changes. Carousels (QuizArena,
  // CodePlayground) reuse the same EvidenceImage instance and swap `src` per
  // item; without this a prior frame's `failed` would null out a later valid
  // frame, and a prior `loaded` would skip the skeleton for the next one.
  // Render-phase reset (vs useEffect) avoids a flash of the stale frame.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setLoaded(false);
    setFailed(false);
    setRetried(false);
  }

  const handleError = () => {
    if (retried) {
      setFailed(true);
    } else {
      setRetried(true);
    }
  };

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-dashed border-border/40',
          'bg-muted/10 px-3 py-2 text-xs text-muted-foreground',
          className,
        )}
      >
        <ImageOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Frame unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border/40 bg-muted/20 aspect-video',
        className,
      )}
    >
      {!loaded && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none motion-reduce:animate-none" />
      )}
      <img
        key={retried ? 'retry' : 'first'}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
      {children}
    </div>
  );
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
    // No usable image source → skip the empty 16:9 frame entirely and render
    // only the lightweight text block (mirrors the compact imageless path) so
    // we never show a dead gray rectangle.
    if (!thumbnailUrl) {
      return (
        <figure
          data-slot="visual-evidence"
          data-variant="figure"
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
        </figure>
      );
    }

    return (
      <figure
        data-slot="visual-evidence"
        data-variant="figure"
        className={cn('flex flex-col gap-2', className)}
      >
        <EvidenceImage src={thumbnailUrl} alt={caption || 'Frame from video'}>
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
        </EvidenceImage>
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
        <EvidenceImage
          src={thumbnailUrl}
          alt={caption || 'Frame'}
          className="w-full max-w-[240px] rounded border-border/30"
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
