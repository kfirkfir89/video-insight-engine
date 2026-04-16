import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ImageCardProps {
  src: string;
  alt: string;
  children?: ReactNode;
  aspectRatio?: 'video' | 'square' | 'wide';
  className?: string;
}

const ASPECT_CLASSES = {
  video: 'aspect-video',
  square: 'aspect-square',
  wide: 'aspect-[21/9]',
} as const;

/**
 * Card with image header and optional content body.
 */
export const ImageCard = memo(function ImageCard({
  src,
  alt,
  children,
  aspectRatio = 'video',
  className,
}: ImageCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-[var(--glass-bg)]',
        className,
      )}
    >
      <div className={cn('relative overflow-hidden', ASPECT_CLASSES[aspectRatio])}>
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {children && <div className="p-5">{children}</div>}
    </div>
  );
});
