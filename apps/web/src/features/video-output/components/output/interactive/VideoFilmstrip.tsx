import { memo, useCallback } from 'react';
import { Film } from 'lucide-react';
import { EvidenceImage } from '@/components/vie';
import { cn } from '@/lib/utils';
import { EmptyTabState } from './EmptyTabState';

export interface FilmstripFrame {
  thumbnailUrl: string;
  timestamp: number;
  caption?: string;
  ocr?: string;
  sceneType?: string;
}

interface VideoFilmstripProps {
  frames: FilmstripFrame[];
  onSeek?: (seconds: number) => void;
  currentTime?: number;
  mode?: 'tab' | 'overlay';
}

const ACTIVE_WINDOW_SECONDS = 5;

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Horizontal scrubber of video frames — the "move through the video"
 * browser. `mode='tab'` is information-rich: every cell carries a visible
 * one-line caption (what's on screen at that point) under the frame, with
 * the full caption + OCR in the hover tooltip. `mode='overlay'` (default)
 * stays a thin image-only strip for inline placement.
 *
 * Whole-cell click seeks — that IS the scrubber's job (unlike MomentTrack,
 * where clicking shows the image). Frames within ±5s of `currentTime` get a
 * highlighted ring as the playhead indicator.
 */
export const VideoFilmstrip = memo(function VideoFilmstrip({
  frames,
  onSeek,
  currentTime,
  mode = 'overlay',
}: VideoFilmstripProps) {
  const handleClick = useCallback(
    (timestamp: number) => {
      onSeek?.(timestamp);
    },
    [onSeek],
  );

  if (frames.length === 0) return mode === 'overlay' ? null : <EmptyTabState message="No frames were captured for this video." icon={Film} />;

  const isTabMode = mode === 'tab';
  // Tab cells are wider so the visible caption line stays legible.
  const cellWidth = isTabMode ? 'w-[160px]' : 'w-[88px]';

  return (
    <div
      data-slot="video-filmstrip"
      data-mode={mode}
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-thin',
        isTabMode ? 'py-2' : 'py-1',
      )}
      role="list"
      aria-label="Video frames"
    >
      {frames.map((frame, index) => {
        const isActive =
          typeof currentTime === 'number' &&
          Math.abs(currentTime - frame.timestamp) <= ACTIVE_WINDOW_SECONDS;
        const stampLabel = formatTimestamp(frame.timestamp);

        return (
          <div
            key={`${frame.timestamp}-${index}`}
            role="listitem"
            className={cn('relative shrink-0', cellWidth)}
          >
            <button
              type="button"
              onClick={() => handleClick(frame.timestamp)}
              aria-label={`Jump to ${stampLabel}${frame.caption ? `: ${frame.caption}` : ''}`}
              className={cn(
                'group relative block w-full overflow-hidden rounded-md border bg-muted/20',
                'aspect-video transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0',
                isActive
                  ? 'border-[var(--vie-accent)] ring-2 ring-[var(--vie-accent)]/60 shadow-[0_0_20px_-4px_var(--vie-accent)]'
                  : 'border-border/40 hover:border-border',
              )}
            >
              <EvidenceImage
                src={frame.thumbnailUrl}
                alt={frame.caption ?? `Frame at ${stampLabel}`}
                className="rounded-none border-0"
              />
              <span
                className={cn(
                  'absolute bottom-1 end-1 rounded bg-background/85 px-1 py-0.5',
                  'text-[10px] font-mono tabular-nums text-foreground/90 backdrop-blur',
                )}
                dir="ltr"
              >
                {stampLabel}
              </span>

              {/* Hover preview tooltip */}
              {(frame.caption || frame.ocr) && (
                <span
                  role="tooltip"
                  className={cn(
                    'pointer-events-none absolute start-1/2 z-20 -translate-x-1/2',
                    'bottom-full mb-2 w-48 rounded-md bg-foreground px-2 py-1.5',
                    'text-[11px] leading-snug text-background shadow-lg',
                    'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
                  )}
                >
                  {frame.caption && <span className="block">{frame.caption}</span>}
                  {frame.ocr && (
                    <span className="mt-0.5 block font-mono text-[10px] opacity-80">
                      &ldquo;{frame.ocr}&rdquo;
                    </span>
                  )}
                </span>
              )}
            </button>

            {isTabMode && (
              <div className="mt-1 space-y-0.5">
                <span
                  className="block text-center text-[10px] font-mono tabular-nums text-muted-foreground"
                  dir="ltr"
                >
                  {stampLabel}
                </span>
                {frame.caption && (
                  <p
                    className="text-start text-[11px] leading-snug text-muted-foreground line-clamp-2"
                    title={frame.caption}
                  >
                    {frame.caption}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
