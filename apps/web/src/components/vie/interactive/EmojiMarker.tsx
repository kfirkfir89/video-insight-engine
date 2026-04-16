import { memo } from 'react';
import { cn } from '@/lib/utils';

interface EmojiMarkerProps {
  emoji: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

/**
 * Sized emoji with proper aria attributes.
 */
export const EmojiMarker = memo(function EmojiMarker({
  emoji,
  size = 'md',
  className,
}: EmojiMarkerProps) {
  return (
    <span
      className={cn('inline-block leading-none', SIZE_CLASSES[size], className)}
      role="img"
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
});
