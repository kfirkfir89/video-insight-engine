import { memo, useCallback } from 'react';
import { Film } from 'lucide-react';
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
 * Horizontal scrubber of video frames. `mode='tab'` shows full labels for
 * standalone tab use; `mode='overlay'` (default) renders a thin strip
 * suitable for inline placement above other components.
 *
 * Frames within ±5s of `currentTime` get a highlighted ring as the playhead
 * indicator. Hover reveals a larger preview + caption tooltip.
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
  const cellWidth = isTabMode ? 'w-[120px]' : 'w-[88px]';

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
                  ? 'border-primary ring-2 ring-primary/60 shadow-[0_0_20px_-4px_var(--primary)]'
                  : 'border-border/40 hover:border-border',
              )}
            >
              <img
                src={frame.thumbnailUrl}
                alt={frame.caption ?? `Frame at ${stampLabel}`}
                loading="lazy"
                className="h-full w-full object-cover"
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
              <div className="mt-1 text-center">
                <span
                  className="text-[10px] font-mono tabular-nums text-muted-foreground"
                  dir="ltr"
                >
                  {stampLabel}
                </span>
                {frame.sceneType && (
                  <span className="ms-1 text-[10px] capitalize text-muted-foreground/60">
                    {frame.sceneType.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
