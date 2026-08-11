import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Lightbox } from '../Lightbox';

const frames = [
  { imageUrl: 'https://example.com/a.png', caption: 'Frame A' },
  { imageUrl: 'https://example.com/b.png', caption: 'Frame B' },
];

describe('Lightbox', () => {
  describe('focus restoration', () => {
    it('should move focus onto the lightbox dialog when it opens', () => {
      render(
        <Lightbox
          frames={frames}
          activeIndex={0}
          onClose={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
      expect(
        screen.getByRole('dialog', { name: 'Image lightbox' }),
      ).toHaveFocus();
    });

    it('should restore focus to the trigger element when it closes', () => {
      render(<button type="button">open lightbox</button>);
      const trigger = screen.getByRole('button', { name: 'open lightbox' });
      trigger.focus();

      const { unmount } = render(
        <Lightbox
          frames={frames}
          activeIndex={0}
          onClose={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
      expect(trigger).not.toHaveFocus();

      unmount();
      expect(trigger).toHaveFocus();
    });

    it('should call onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(
        <Lightbox
          frames={frames}
          activeIndex={0}
          onClose={onClose}
          onNavigate={vi.fn()}
        />,
      );
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
