import { memo, useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/vie';


type GalleryLayout = 'grid' | 'carousel' | 'hero_stack';

interface GalleryImage {
  url?: string;
  query?: string;
  caption?: string;
  alt?: string;
  timestamp?: number;
}

interface GalleryInteractiveProps {
  images: GalleryImage[];
  layout?: GalleryLayout;
  onSeek?: (seconds: number) => void;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

function ImagePlaceholder({ image, className, onClick, onSeek }: { image: GalleryImage; className?: string; onClick?: () => void; onSeek?: (seconds: number) => void }) {
  const src = image.url ?? `https://placehold.co/600x400/1a1a2e/eee?text=${encodeURIComponent(image.query ?? 'Image')}`;
  const handleClick = () => {
    if (image.timestamp != null && onSeek) {
      onSeek(image.timestamp);
    }
    onClick?.();
  };
  return (
    <div
      className={cn('relative overflow-hidden rounded-lg bg-muted/30 cursor-pointer group', className)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleClick())}
    >
      <img
        src={src}
        alt={image.alt ?? image.caption ?? ''}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {image.caption && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-xs text-[var(--overlay-text)]">{image.caption}</p>
        </div>
      )}
    </div>
  );
}

function GalleryLightbox({ images, index, onClose, onPrev, onNext }: {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft') onPrev();
    else if (e.key === 'ArrowRight') onNext();
  };

  const img = images[index];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)] p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      tabIndex={-1}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 end-4 text-[var(--overlay-text)] hover:text-[var(--overlay-text-muted)] z-10"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <X className="h-5 w-5" />
      </Button>

      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--overlay-text)] hover:text-[var(--overlay-text-muted)] z-10"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            disabled={index === 0}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--overlay-text)] hover:text-[var(--overlay-text-muted)] z-10"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            disabled={index === images.length - 1}
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </Button>
        </>
      )}

      <div className="relative max-w-4xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={img.url ?? `https://placehold.co/1200x800/1a1a2e/eee?text=${encodeURIComponent(img.query ?? 'Image')}`}
          alt={img.alt ?? img.caption ?? ''}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        {img.caption && (
          <p className="text-center text-sm text-[var(--overlay-text)] mt-3">{img.caption}</p>
        )}
        {images.length > 1 && (
          <p className="text-center text-xs text-[var(--overlay-text-muted)] mt-2 tabular-nums">{index + 1} / {images.length}</p>
        )}
      </div>
    </div>
  );
}

export const GalleryInteractive = memo(function GalleryInteractive({
  images,
  layout = 'grid',
  onSeek,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: GalleryInteractiveProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Grid layout */}
      {layout === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((image, i) => (
            <FadeIn key={i} index={i}>
              <ImagePlaceholder
                image={image}
                className="aspect-square"
                onClick={() => setLightboxIndex(i)}
                onSeek={onSeek}
              />
            </FadeIn>
          ))}
        </div>
      )}

      {/* Carousel layout */}
      {layout === 'carousel' && (
        <div className="space-y-3">
          <FadeIn key={carouselIndex}>
            <ImagePlaceholder
              image={images[carouselIndex]}
              className="aspect-video"
              onClick={() => setLightboxIndex(carouselIndex)}
              onSeek={onSeek}
            />
          </FadeIn>
          {images.length > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                disabled={carouselIndex === 0}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">{carouselIndex + 1} / {images.length}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCarouselIndex((i) => Math.min(images.length - 1, i + 1))}
                disabled={carouselIndex === images.length - 1}
                className="gap-1 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hero stack layout */}
      {layout === 'hero_stack' && images.length > 0 && (
        <div className="space-y-3">
          <FadeIn>
            <ImagePlaceholder
              image={images[0]}
              className="aspect-video"
              onClick={() => setLightboxIndex(0)}
              onSeek={onSeek}
            />
          </FadeIn>
          {images.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.slice(1).map((img, i) => (
                <FadeIn key={i + 1} index={i}>
                  <ImagePlaceholder
                    image={img}
                    className="aspect-square"
                    onClick={() => setLightboxIndex(i + 1)}
                    onSeek={onSeek}
                  />
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox overlay with keyboard nav */}
      {lightboxIndex !== null && (
        <GalleryLightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(images.length - 1, (i ?? 0) + 1))}
        />
      )}

    </div>
  );
});
