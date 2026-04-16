import { memo, useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageGalleryProps {
  images: Array<{ src: string; alt: string; caption?: string }>;
  columns?: 2 | 3 | 4;
  className?: string;
}

function ImageLightbox({
  images,
  selected,
  onClose,
  onPrev,
  onNext,
}: {
  images: Array<{ src: string; alt: string; caption?: string }>;
  selected: number;
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

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)] p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Image preview"
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
            disabled={selected === 0}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--overlay-text)] hover:text-[var(--overlay-text-muted)] z-10"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            disabled={selected === images.length - 1}
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </Button>
        </>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <img
          src={images[selected].src}
          alt={images[selected].alt}
          className="max-w-full max-h-full object-contain rounded-lg"
          loading="eager"
          decoding="async"
          width={1280}
          height={720}
          style={{ aspectRatio: '16 / 9' }}
        />
        {images[selected].caption && (
          <p className="text-center text-sm leading-relaxed text-[var(--overlay-text)] mt-3 bg-[var(--overlay-surface)] px-4 py-2 rounded max-w-prose mx-auto">
            {images[selected].caption}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Grid gallery of images with lightbox on click.
 */
export const ImageGallery = memo(function ImageGallery({
  images,
  columns = 3,
  className,
}: ImageGalleryProps) {
  const [selected, setSelected] = useState<number | null>(null);

  if (images.length === 0) return null;

  const colClass = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  return (
    <>
      <div className={cn('grid gap-2', colClass, className)}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="relative aspect-video overflow-hidden rounded-lg border border-[var(--glass-border)] hover:opacity-90 transition-opacity"
          >
            <img
              src={img.src}
              alt={img.alt}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              width={320}
              height={180}
            />
          </button>
        ))}
      </div>

      {/* Lightbox with keyboard nav and close button */}
      {selected !== null && (
        <ImageLightbox
          images={images}
          selected={selected}
          onClose={() => setSelected(null)}
          onPrev={() => setSelected((i) => i !== null && i > 0 ? i - 1 : i)}
          onNext={() => setSelected((i) => i !== null && i < images.length - 1 ? i + 1 : i)}
        />
      )}
    </>
  );
});
