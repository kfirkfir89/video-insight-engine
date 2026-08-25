import { memo } from 'react';
import { Check, Play, Share2 } from 'lucide-react';

import { EvidenceImage, FadeIn } from '@/components/vie';
import { cn } from '@/lib/utils';

import { getMoodColor } from '../../../lib/moodColors';
import { formatDuration, isClip, resolveLabel, type MomentItem } from './moment-utils';

interface MomentGalleryCardProps {
  item: MomentItem;
  originalIndex: number;
  /** Position within the filtered list — drives the FadeIn stagger. */
  index: number;
  isActive: boolean;
  copied: boolean;
  currentTime?: number;
  onSeek?: (seconds: number) => void;
  /** Open this moment's image full-size (lightbox). */
  onExpand?: (originalIndex: number) => void;
  onShare: (item: MomentItem, index: number) => void;
}

/**
 * Grid-view card: a 16:9 frame hero (Frame-as-Hero) with the moment text
 * beneath. Clicking the card SHOWS the image (lightbox) — never seeks; the
 * only seek affordance is the explicit Jump pill over the hero. Frameless
 * cards fall back to seeking on click (there is no image to show). Share is
 * a sibling control (a button can't legally nest a button), and LLM frame
 * metadata (caption/OCR/scene type) never renders — internal signal only.
 */
export const MomentGalleryCard = memo(function MomentGalleryCard({
  item,
  originalIndex,
  index,
  isActive,
  copied,
  currentTime,
  onSeek,
  onExpand,
  onShare,
}: MomentGalleryCardProps) {
  const clip = isClip(item);
  const duration = clip ? (item.endSeconds as number) - item.seconds : 0;
  const label = resolveLabel(item);
  const moodColor = getMoodColor(item.mood);
  const hasImage = Boolean(item.thumbnailUrl);
  const canExpand = hasImage && onExpand != null;
  const progress =
    clip && isActive && currentTime != null && duration > 0
      ? Math.max(0, Math.min(1, (currentTime - item.seconds) / duration))
      : null;

  return (
    <FadeIn index={index}>
      <div className="group/card relative h-full" data-kind={clip ? 'clip' : 'moment'} data-active={isActive ? 'true' : undefined}>
        <button
          type="button"
          onClick={() => (canExpand ? onExpand(originalIndex) : onSeek?.(item.seconds))}
          aria-label={canExpand ? `View image: ${label}` : `Jump to ${item.time}: ${label}`}
          data-testid={`gallery-card-${originalIndex}`}
          className={cn(
            'block w-full h-full text-start rounded-lg cursor-pointer',
            'transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
            'hover:scale-[1.02] hover:shadow-md motion-reduce:hover:scale-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vie-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          {/* 16:9 hero — frame when available, glyph plate otherwise. */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border',
              isActive
                ? 'border-[var(--vie-accent)] ring-2 ring-[var(--vie-accent)]/60 shadow-[0_0_20px_-4px_var(--vie-accent)]'
                : 'border-border/40',
            )}
          >
            {item.thumbnailUrl ? (
              <EvidenceImage
                src={item.thumbnailUrl}
                alt={item.frameCaption ?? `Frame at ${item.time}`}
                className="rounded-none border-0"
              />
            ) : (
              <div className="relative aspect-video bg-muted/20">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-[0.08]"
                  style={{ background: moodColor }}
                />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  {item.emoji && (
                    <span aria-hidden="true" className="text-3xl leading-none">
                      {item.emoji}
                    </span>
                  )}
                  <span dir="ltr" className="font-mono text-xl font-semibold tabular-nums text-foreground/70">
                    {item.time}
                  </span>
                </span>
              </div>
            )}

            {clip && (
              <span
                dir="ltr"
                className={cn(
                  'absolute top-1.5 end-1.5 rounded-full bg-background/85 px-1.5 py-0.5',
                  'text-[10px] font-medium tabular-nums text-foreground/90 backdrop-blur',
                  'transition-opacity group-hover/card:opacity-0 group-focus-within/card:opacity-0',
                )}
              >
                {formatDuration(duration)}
              </span>
            )}
            {progress != null && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left rtl:origin-right bg-[var(--vie-accent)]"
                style={{ transform: `scaleX(${progress})` }}
              />
            )}
          </div>

          <div className="mt-2 space-y-1 px-0.5">
            <div className="flex items-start gap-1.5">
              {item.mood && (
                <span
                  aria-label={`Mood: ${item.mood}`}
                  className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full"
                  style={{ background: moodColor }}
                />
              )}
              <p className="text-sm font-semibold leading-snug line-clamp-2" title={label}>
                {label}
              </p>
            </div>
            {item.description && item.description !== label && (
              <p className="text-xs leading-snug text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            )}
          </div>
        </button>

        {/* Share — hover/focus reveal over the hero. Sibling of the seek
            button, positioned in the duration pill's slot (they crossfade). */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShare(item, originalIndex);
          }}
          aria-label={copied ? 'Link copied' : `Share ${clip ? 'clip' : 'moment'} at ${item.time}`}
          data-testid={`gallery-share-${originalIndex}`}
          className={cn(
            'absolute top-1.5 end-1.5 z-10 inline-flex items-center gap-1 rounded-md bg-background/85 p-1.5 backdrop-blur',
            // pointer-events-none while hidden: opacity alone keeps the hit
            // target live, so a stray tap on a touch device (no hover) would
            // fire a clipboard write instead of the card's seek.
            'pointer-events-none opacity-0 transition-opacity',
            'group-hover/card:pointer-events-auto group-hover/card:opacity-100',
            'group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100',
            'focus-visible:pointer-events-auto focus-visible:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vie-accent)]/60',
            copied ? 'pointer-events-auto text-success opacity-100' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-[10px] font-medium">Link copied</span>
            </>
          ) : (
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        {/* Jump — THE seek affordance, always visible at the hero's top-start
            (the slot the removed scene badge freed; anchoring from the top is
            deterministic for a sibling that can't know the text height). The
            card click itself only shows the image. */}
        {onSeek && hasImage && (
          <button
            type="button"
            dir="ltr"
            onClick={(event) => {
              event.stopPropagation();
              onSeek(item.seconds);
            }}
            aria-label={`Jump to ${item.time}`}
            data-testid={`gallery-jump-${originalIndex}`}
            className={cn(
              'absolute top-1.5 start-1.5 z-10 inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 backdrop-blur',
              'font-mono text-[11px] font-bold tabular-nums text-[var(--vie-accent)]',
              'transition-colors hover:bg-[var(--vie-accent)]/15',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vie-accent)]/60',
            )}
          >
            <Play className="h-3 w-3 shrink-0" aria-hidden="true" />
            {item.time}
          </button>
        )}
      </div>
    </FadeIn>
  );
});
