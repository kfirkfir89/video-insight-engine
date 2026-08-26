import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

import { Lightbox } from '../Lightbox';
import {
  VideoPlayerProvider,
  useVideoPlayer,
} from '@/features/video-output/contexts/VideoPlayerContext';

const frames = [
  { imageUrl: 'https://example.com/a.png', caption: 'Frame A' },
  { imageUrl: 'https://example.com/b.png', caption: 'Frame B' },
];

/** Opens the inline player (registering its document Escape listener) and
 *  then mounts a lightbox ON TOP — the real gallery flow: Jump → player open →
 *  click a moment image → lightbox. */
function PlayerThenLightbox({ onClose }: { onClose: () => void }) {
  const { isPlayerOpen, openPlayer } = useVideoPlayer();
  return (
    <>
      <button type="button" onClick={openPlayer}>
        open player
      </button>
      <span data-testid="player-state">{isPlayerOpen ? 'open' : 'closed'}</span>
      {isPlayerOpen && (
        <Lightbox frames={frames} activeIndex={0} onClose={onClose} onNavigate={vi.fn()} />
      )}
    </>
  );
}

describe('Lightbox + VideoPlayer Escape contract', () => {
  it('should close only the lightbox on Escape when the player opened first', () => {
    // Regression: both handlers listened on `document` in the bubble phase, so
    // the player's listener (registered when it opened, earlier) ran first,
    // saw defaultPrevented=false and collapsed the player underneath the
    // lightbox. The lightbox now listens in the capture phase.
    const onClose = vi.fn();
    render(
      <VideoPlayerProvider>
        <PlayerThenLightbox onClose={onClose} />
      </VideoPlayerProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'open player' }));
    });
    expect(screen.getByTestId('player-state')).toHaveTextContent('open');
    expect(screen.getByRole('dialog', { name: 'Image lightbox' })).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('player-state')).toHaveTextContent('open');
  });

  it('should still close the player on Escape once no lightbox is mounted', () => {
    function PlayerOnly() {
      const { isPlayerOpen, openPlayer } = useVideoPlayer();
      return (
        <>
          <button type="button" onClick={openPlayer}>
            open player
          </button>
          <span data-testid="player-state">{isPlayerOpen ? 'open' : 'closed'}</span>
        </>
      );
    }
    render(
      <VideoPlayerProvider>
        <PlayerOnly />
      </VideoPlayerProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'open player' }));
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });

    expect(screen.getByTestId('player-state')).toHaveTextContent('closed');
  });
});
