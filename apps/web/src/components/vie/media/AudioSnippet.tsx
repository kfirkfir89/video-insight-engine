import { memo } from 'react';
import { cn } from '@/lib/utils';

interface AudioSnippetProps {
  src: string;
  label?: string;
  className?: string;
}

/**
 * Audio player stub.
 * Basic HTML audio element for future expansion.
 */
export const AudioSnippet = memo(function AudioSnippet({
  src,
  label,
  className,
}: AudioSnippetProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <audio src={src} controls preload="metadata" className="w-full">
        Your browser does not support the audio element.
      </audio>
    </div>
  );
});
