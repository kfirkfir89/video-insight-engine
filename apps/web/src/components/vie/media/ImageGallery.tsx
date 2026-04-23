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

  useEffect(() => { overlayRef.current?.focus(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft') onPrev();
    else if (e.key === 'ArrowRight') onNext();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)] backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease_both]"
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

      {/* Keyed on `selected` so each index transition restarts the CSS mount animation. */}
      <div
        key={selected}
        className="animate-[scale-in_0.32s_cubic-bezier(0.16,1,0.3,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[selected].src}
          alt={images[selected].alt}
          className="max-w-full max-h-full object-contain rounded-xl shadow-[0_20px_60px_-20px_oklch(0%_0_0_/_0.45)]"
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

export const ImageGallery = memo(function ImageGallery({
  images,
  columns = 3,
  className,
}: ImageGalleryProps) {
  const [selected, setSelected] = useState<number | null>(null);

  if (images.length === 0) return null;

  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

  return (
    <>
      <div className={cn('grid gap-2', colClass, className)}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            style={{ animationDelay: `${i * 40}ms` }}
            className="group relative aspect-video overflow-hidden rounded-lg border border-[var(--glass-border)] animate-fade-up hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 ease-[var(--ease-out-expo)]"
            aria-label={`Open ${img.alt}`}
          >
            <img
              src={img.src}
              alt={img.alt}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[600ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.08]"
              loading="lazy"
              decoding="async"
              width={320}
              height={180}
            />
            <span
              className="absolute inset-0 bg-gradient-to-t from-[oklch(0%_0_0_/_0.4)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      {selected !== null && (
        <ImageLightbox
          images={images}
          selected={selected}
          onClose={() => setSelected(null)}
          onPrev={() => setSelected((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setSelected((i) => (i !== null && i < images.length - 1 ? i + 1 : i))}
        />
      )}
    </>
  );
});
