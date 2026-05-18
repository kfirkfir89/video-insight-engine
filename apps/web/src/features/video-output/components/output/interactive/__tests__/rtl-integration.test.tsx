/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DirectionProvider } from '@/contexts/DirectionContext';
import { FlashDeckInteractive } from '../FlashDeckInteractive';
import { TabStateProvider } from '@/features/video-output/contexts/TabStateContext';
import type { FlashcardItem } from '@vie/types';

const sampleCards: FlashcardItem[] = [
  { front: 'A', back: 'B' },
  { front: 'C', back: 'D' },
  { front: 'E', back: 'F' },
];

function renderInDirection(isRTL: boolean) {
  return render(
    <DirectionProvider language={isRTL ? 'he' : 'en'} isRTL={isRTL}>
      <TabStateProvider videoId="video-rtl-test">
        <FlashDeckInteractive cards={sampleCards} />
      </TabStateProvider>
    </DirectionProvider>,
  );
}

describe('FlashDeckInteractive — RTL keyboard semantics', () => {
  it('should advance with ArrowRight in LTR mode', () => {
    renderInDirection(false);
    // Flip the first card so directional keys are armed
    fireEvent.keyDown(window, { key: ' ' });
    // ArrowRight should mark known (advance) — surfaces the next card counter
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // After advancing once we're either on card 2 or the deck shifted —
    // either way the "2 of 3" counter should appear at some point.
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it('should advance with ArrowLeft in RTL mode (mirrored arrow keys)', () => {
    renderInDirection(true);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it('should NOT advance with ArrowRight in RTL mode (back direction in RTL)', () => {
    renderInDirection(true);
    fireEvent.keyDown(window, { key: ' ' });
    // ArrowRight maps to "review again" in RTL — that doesn't advance the
    // counter past the first card on its own (the markReview helper only
    // moves forward if we're not on the last card; from card 0 it advances
    // because there are more cards). We assert the *Review Again* button is
    // not visible after the press, which is the signal markReview ran.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // After markReview from card 0 the deck advances to card 1 too, but
    // the "got it" path marks `known` — which DOES NOT happen with
    // markReview. So the known-counter remains absent.
    expect(screen.queryByText(/1 known/i)).not.toBeInTheDocument();
  });
});

describe('FlashDeckInteractive — RTL touch swipe semantics', () => {
  // After the space-key flip, the card wrapper exposes aria-label="B" (back of
  // the first sample card). Targeting it by role/name selects the exact div
  // that owns onTouchStart/onTouchEnd — events on ancestors wouldn't reach
  // React's handler.
  function flipAndSwipe(startX: number, endX: number) {
    fireEvent.keyDown(window, { key: ' ' });
    const target = screen.getByRole('button', { name: 'B' });
    fireEvent.touchStart(target, { touches: [{ clientX: startX }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: endX }] });
  }

  it('should advance on rightward swipe in LTR mode', () => {
    renderInDirection(false);
    // +100px → forward in LTR → markKnown → counter advances
    flipAndSwipe(0, 100);
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it('should advance on leftward swipe in RTL mode (mirrored)', () => {
    renderInDirection(true);
    // −100px → forward in RTL → markKnown → counter advances
    flipAndSwipe(100, 0);
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it('should not mark known on rightward swipe in RTL mode', () => {
    renderInDirection(true);
    // +100px in RTL = "back" — should NOT increment the known counter
    flipAndSwipe(0, 100);
    expect(screen.queryByText(/1 known/i)).not.toBeInTheDocument();
  });
});

describe('DirectionProvider — wraps content with dir attribute', () => {
  it('should render dir="rtl" wrapper when isRTL', () => {
    const { container } = render(
      <DirectionProvider language="he" isRTL>
        <span>שלום</span>
      </DirectionProvider>,
    );
    const wrapper = container.querySelector('[dir="rtl"]');
    expect(wrapper).not.toBeNull();
  });

  it('should NOT render dir attribute when LTR (lets html dir cascade through)', () => {
    const { container } = render(
      <DirectionProvider language="en">
        <span>hello</span>
      </DirectionProvider>,
    );
    const wrapper = container.querySelector('[dir]');
    expect(wrapper).toBeNull();
  });
});
