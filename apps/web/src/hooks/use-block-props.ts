import { useMemo } from 'react';

export interface BlockProps {
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Memoize the block-level playback props passed to ContentBlocks.
 * Prevents re-creating the object on every render, which would
 * invalidate memoized children that spread these props.
 */
export function useBlockProps(
  onPlay?: (seconds: number) => void,
  onStop?: () => void,
  isVideoActive?: boolean,
  activeStartSeconds?: number,
): BlockProps {
  return useMemo(
    () => ({ onPlay, onStop, isVideoActive, activeStartSeconds }),
    [onPlay, onStop, isVideoActive, activeStartSeconds],
  );
}
