import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

export interface LightboxFrame {
  imageUrl: string;
  caption?: string;
}

interface LightboxProps {
  frames: LightboxFrame[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Minimal lightbox overlay for viewing images full-screen.
 * Supports gallery navigation via arrows and keyboard.
 * Portaled to document.body for stacking context independence.
 */
export const Lightbox = memo(function Lightbox({
  frames,
  activeIndex,
  onClose,
  onNavigate,
}: LightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);
  const hasMultiple = frames.length > 1;
  const current = frames[activeIndex];

  // Reset error state on navigation
  useEffect(() => setImgError(false), [activeIndex]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) onNavigate(activeIndex - 1);
  }, [activeIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (activeIndex < frames.length - 1) onNavigate(activeIndex + 1);
  }, [activeIndex, frames.length, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          // Consume the key: document-level Escape handlers (the video
          // player's close) check defaultPrevented and must not also fire.
          // Registered in the CAPTURE phase below — same-target bubble
          // listeners run in registration order, and the player's (attached
          // when it opened, before this lightbox mounted) would otherwise
          // see the key first and close underneath us.
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    }
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose, handlePrev, handleNext]);

  // Focus trap — keep focus inside lightbox
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!current) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--overlay-bg)] backdrop-blur-sm animate-in fade-in duration-200 outline-none"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lightbox"
        className="absolute top-4 end-4 z-10 rounded-full bg-[var(--overlay-surface)] p-2 text-[var(--overlay-text-muted)] hover:bg-[var(--overlay-surface)] hover:text-[var(--overlay-text)] transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter badge */}
      {hasMultiple && (
        <div
          className="absolute top-4 start-4 z-10 rounded-full bg-[var(--overlay-surface)] px-3 py-1 text-sm text-[var(--overlay-text-muted)]"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">Image </span>
          {activeIndex + 1} <span className="sr-only">of</span><span aria-hidden="true">/</span> {frames.length}
        </div>
      )}

      {/* Navigation arrows — deliberately physical (left/right, not
          start/end): spatial prev/next must match the visual axis and the
          ArrowLeft/ArrowRight keys in both text directions. */}
      {hasMultiple && activeIndex > 0 && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous image"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-[var(--overlay-surface)] p-2 text-[var(--overlay-text-muted)] hover:bg-[var(--overlay-surface)] hover:text-[var(--overlay-text)] transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {hasMultiple && activeIndex < frames.length - 1 && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next image"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-[var(--overlay-surface)] p-2 text-[var(--overlay-text-muted)] hover:bg-[var(--overlay-surface)] hover:text-[var(--overlay-text)] transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Main image */}
      {imgError ? (
        <div className="flex flex-col items-center gap-2 text-[var(--overlay-text-muted)]">
          <ImageOff className="h-12 w-12" />
          <p className="text-sm">Image unavailable</p>
        </div>
      ) : (
        <img
          src={current.imageUrl}
          alt={current.caption ?? ''}
          loading="eager"
          decoding="async"
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg select-none"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      )}

      {/* Caption */}
      {current.caption && (
        <p className="mt-3 text-sm text-[var(--overlay-text-muted)] text-center max-w-xl px-4">
          {current.caption}
        </p>
      )}
    </div>,
    document.body,
  );
});
