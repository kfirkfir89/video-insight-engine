import { memo, useCallback, useRef, useState } from 'react';
import { Eye, ImageOff, Images, Layout, Monitor, PenTool, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { Lightbox } from '@/components/ui/Lightbox';
import type { VisualBlock as VisualBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';
import { isAllowedImageHost } from '@/lib/image-hosts';

interface VisualBlockProps {
  block: VisualBlockType;
  onSeek?: (seconds: number) => void;
}

const VARIANT_CONFIG = {
  diagram: { icon: Layout, label: BLOCK_LABELS.diagram },
  screenshot: { icon: Monitor, label: BLOCK_LABELS.screenshot },
  demo: { icon: Monitor, label: BLOCK_LABELS.demo },
  whiteboard: { icon: PenTool, label: BLOCK_LABELS.whiteboard },
  slideshow: { icon: Presentation, label: BLOCK_LABELS.slideshow },
  gallery: { icon: Images, label: BLOCK_LABELS.gallery },
} as const;

function formatTimestamp(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Single Image Mode ───

function VisualSingle({ block, onSeek }: VisualBlockProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const hasImage = block.imageUrl && !imgFailed && isAllowedImageHost(block.imageUrl);
  const variant = block.variant ?? 'screenshot';
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.screenshot;

  return (
    <>
      <div className="space-y-2">
        {hasImage ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group relative w-full rounded-lg overflow-hidden bg-muted/10 cursor-zoom-in"
            aria-label="View full size"
          >
            <img
              src={block.imageUrl!}
              alt={block.label ?? block.description ?? ''}
              className="w-full h-auto max-h-72 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
            />
            {/* Variant chip overlay */}
            <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
              {config.label}
            </span>
          </button>
        ) : imgFailed ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/10 p-4 text-muted-foreground text-sm">
            <ImageOff className="h-4 w-4 shrink-0" />
            <span>Frame unavailable</span>
          </div>
        ) : null}

        {/* Description as subtle text below */}
        {block.description && (
          <p className="text-sm text-muted-foreground" title={block.description}>
            {block.description}
          </p>
        )}

        {/* Timestamp link */}
        {block.timestamp !== undefined && block.timestamp >= 0 && onSeek && (
          <button
            type="button"
            onClick={() => { if (block.timestamp !== undefined) onSeek(block.timestamp); }}
            aria-label={`View visual at ${formatTimestamp(block.timestamp)}`}
            className="inline-flex items-center gap-1.5 text-xs text-primary/60 hover:text-primary transition-colors"
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            <span>{BLOCK_LABELS.viewVisual}</span>
          </button>
        )}
      </div>

      {lightboxOpen && hasImage && (
        <Lightbox
          frames={[{ imageUrl: block.imageUrl!, caption: block.label ?? block.description }]}
          activeIndex={0}
          onClose={() => setLightboxOpen(false)}
          onNavigate={() => {}}
        />
      )}
    </>
  );
}

// ─── Gallery Mode ───

function VisualGallery({ block, onSeek }: VisualBlockProps) {
  const frames = block.frames ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const validFrames = frames
    .map((f, i) => ({ frame: f, originalIdx: i }))
    .filter(({ frame, originalIdx }) => frame.imageUrl && isAllowedImageHost(frame.imageUrl) && !failedImages.has(originalIdx));

  const handleImageError = useCallback((idx: number) => {
    setFailedImages(prev => new Set(prev).add(idx));
  }, []);

  const activeFrame = validFrames[activeIdx] ?? validFrames[0];
  if (!activeFrame) {
    // No valid images — fall back to single mode
    return <VisualSingle block={block} onSeek={onSeek} />;
  }

  const variant = block.variant ?? 'gallery';
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.gallery;

  const lightboxFrames = validFrames
    .map(({ frame }) => ({
      imageUrl: frame.imageUrl!,
      caption: frame.caption,
    }));

  return (
    <>
      <div className="space-y-2">
        {/* Main preview */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative w-full rounded-lg overflow-hidden bg-muted/10 cursor-zoom-in"
          aria-label="View full size"
        >
          <img
            src={activeFrame.frame.imageUrl!}
            alt={activeFrame.frame.caption ?? block.description ?? ''}
            className="w-full h-auto max-h-80 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => handleImageError(activeFrame.originalIdx)}
          />
          {/* Variant chip + counter */}
          <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {config.label}
          </span>
          <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {activeIdx + 1}/{validFrames.length}
          </span>
        </button>

        {/* Thumbnail strip */}
        <div
          ref={thumbStripRef}
          className="flex gap-1.5 overflow-x-auto pb-1 scroll-smooth"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {validFrames.map(({ frame, originalIdx }, i) => (
            <button
              key={originalIdx}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                'shrink-0 rounded-md overflow-hidden transition-all duration-150',
                'w-16 h-12 scroll-snap-start',
                i === activeIdx
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  : 'opacity-60 hover:opacity-100',
              )}
              style={{ scrollSnapAlign: 'start' }}
              aria-label={frame.caption ?? `Frame ${i + 1}`}
            >
              <img
                src={frame.imageUrl!}
                alt={frame.caption ?? ''}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => handleImageError(originalIdx)}
              />
            </button>
          ))}
        </div>

        {/* Failed frames indicator */}
        {failedImages.size > 0 && validFrames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {failedImages.size} frame(s) unavailable
          </p>
        )}

        {/* Active frame caption */}
        {activeFrame.frame.caption && (
          <p className="text-xs text-muted-foreground italic">
            {activeFrame.frame.caption}
          </p>
        )}

        {/* Description */}
        {block.description && (
          <p className="text-sm text-muted-foreground">
            {block.description}
          </p>
        )}

        {/* Timestamp link */}
        {activeFrame.frame.timestamp !== undefined && activeFrame.frame.timestamp >= 0 && onSeek && (
          <button
            type="button"
            onClick={() => {
              if (activeFrame.frame.timestamp !== undefined) onSeek(activeFrame.frame.timestamp);
            }}
            aria-label={`View visual at ${formatTimestamp(activeFrame.frame.timestamp)}`}
            className="inline-flex items-center gap-1.5 text-xs text-primary/60 hover:text-primary transition-colors"
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            <span>{BLOCK_LABELS.viewVisual}</span>
          </button>
        )}
      </div>

      {lightboxOpen && lightboxFrames.length > 0 && (
        <Lightbox
          frames={lightboxFrames}
          activeIndex={activeIdx}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setActiveIdx}
        />
      )}
    </>
  );
}

// ─── Exported Component ───

/**
 * Renders a visual moment block — single image or gallery of frames.
 * Supports variant icons, click-to-enlarge lightbox, timestamp seek.
 */
export const VisualBlock = memo(function VisualBlock({ block, onSeek }: VisualBlockProps) {
  if (!block.description && !block.imageUrl) return null;

  const hasGallery = block.frames && block.frames.length > 1;
  const variant = block.variant ?? 'screenshot';
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.screenshot;
  const Icon = config.icon;

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="card"
      headerIcon={<Icon className="h-3.5 w-3.5" />}
      headerLabel={block.label ?? config.label}
      label={`${BLOCK_LABELS.visual}: ${block.label ?? config.label}`}
    >
      {hasGallery
        ? <VisualGallery block={block} onSeek={onSeek} />
        : <VisualSingle block={block} onSeek={onSeek} />
      }
    </BlockWrapper>
  );
});
