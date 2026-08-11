import { memo } from 'react';
import { cn } from '@/lib/utils';

interface VideoClipProps {
  src: string;
  poster?: string;
  className?: string;
}

export const VideoClip = memo(function VideoClip({
  src,
  poster,
  className,
}: VideoClipProps) {
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-[0_12px_36px_-12px_oklch(from_var(--primary)_l_c_h_/_0.25)] animate-fade-up',
        className,
      )}
    >
      <video src={src} poster={poster} controls preload="metadata" className="w-full">
        <track kind="captions" />
      </video>
    </div>
  );
});
