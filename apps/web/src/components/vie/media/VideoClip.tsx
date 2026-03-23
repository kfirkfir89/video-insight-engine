import { memo } from 'react';
import { cn } from '@/lib/utils';

interface VideoClipProps {
  src: string;
  poster?: string;
  className?: string;
}

/**
 * Embedded video player.
 */
export const VideoClip = memo(function VideoClip({
  src,
  poster,
  className,
}: VideoClipProps) {
  return (
    <div className={cn('rounded-lg overflow-hidden', className)}>
      <video
        src={src}
        poster={poster}
        controls
        preload="metadata"
        className="w-full"
      >
        <track kind="captions" />
      </video>
    </div>
  );
});
