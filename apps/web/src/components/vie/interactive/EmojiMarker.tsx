import { memo } from 'react';
import { cn } from '@/lib/utils';

interface EmojiMarkerProps {
  emoji: string;
  size?: 'sm' | 'md' | 'lg';
  /** Enable hover wiggle. Default true. */
  animated?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

export const EmojiMarker = memo(function EmojiMarker({
  emoji,
  size = 'md',
  animated = true,
  className,
}: EmojiMarkerProps) {
  return (
    <span
      className={cn(
        'inline-block leading-none origin-bottom transition-transform duration-300 ease-[var(--ease-out-expo)]',
        animated && 'hover:scale-[1.18] hover:-rotate-3',
        SIZE_CLASSES[size],
        className,
      )}
      role="img"
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
});
