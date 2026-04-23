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
        'group relative rounded-2xl overflow-hidden border border-border bg-card',
        className,
      )}
    >
      <div className={cn('relative overflow-hidden', ASPECT_CLASSES[aspectRatio])}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[600ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[oklch(from_var(--primary)_l_c_h_/_0.25)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-[var(--ease-out-expo)]"
        />
      </div>
      {children && <div className="p-5">{children}</div>}
    </div>
  );
});
