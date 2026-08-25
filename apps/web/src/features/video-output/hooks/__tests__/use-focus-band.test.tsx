import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { useFocusBand } from '../use-focus-band';

interface HarnessProps {
  enabled: boolean;
  count: number;
}

function Harness({ enabled, count }: HarnessProps) {
  const { setRef } = useFocusBand({ enabled, count });
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} data-testid={`row-${i}`} ref={(el) => setRef(i, el)} />
      ))}
    </div>
  );
}

/** Controllable stand-in for the inert global IntersectionObserver mock. */
class ControlledObserver {
  static instances: ControlledObserver[] = [];
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observed: Element[] = [];
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    ControlledObserver.instances.push(this);
  }

  observe = (el: Element): void => {
    this.observed.push(el);
  };

  unobserve = (el: Element): void => {
    this.observed = this.observed.filter((o) => o !== el);
  };

  emit(entries: Array<Partial<IntersectionObserverEntry>>): void {
    this.callback(
      entries as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

function makeEntry(
  target: Element,
  ratio: number,
  top = 0,
): Partial<IntersectionObserverEntry> {
  return {
    target,
    intersectionRatio: ratio,
    boundingClientRect: { top, height: 100, bottom: top + 100, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRectReadOnly,
    rootBounds: { top: 0, height: 300, bottom: 300, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRectReadOnly,
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('useFocusBand', () => {
  const OriginalObserver = window.IntersectionObserver;

  beforeEach(() => {
    ControlledObserver.instances = [];
  });

  afterEach(() => {
    window.IntersectionObserver = OriginalObserver;
  });

  it('marks nothing by default — the global observer mock never fires', () => {
    render(<Harness enabled={true} count={5} />);
    expect(document.querySelector('[data-focus]')).toBeNull();
  });

  it('creates no observer when disabled or when count < 3', () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    const { unmount } = render(<Harness enabled={false} count={5} />);
    expect(ControlledObserver.instances).toHaveLength(0);
    unmount();
    render(<Harness enabled={true} count={2} />);
    expect(ControlledObserver.instances).toHaveLength(0);
  });

  it('focuses the row with the greatest intersection ratio', async () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    render(<Harness enabled={true} count={4} />);
    const observer = ControlledObserver.instances[0];
    const row0 = screen.getByTestId('row-0');
    const row1 = screen.getByTestId('row-1');

    observer.emit([makeEntry(row0, 0.6), makeEntry(row1, 0.2)]);
    await nextFrame();

    expect(row0.dataset.focus).toBe('true');
    expect(row1.dataset.focus).toBeUndefined();
  });

  it('keeps the incumbent when a challenger leads by 0.15 or less (hysteresis)', async () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    render(<Harness enabled={true} count={4} />);
    const observer = ControlledObserver.instances[0];
    const row0 = screen.getByTestId('row-0');
    const row1 = screen.getByTestId('row-1');

    observer.emit([makeEntry(row0, 0.6)]);
    await nextFrame();
    expect(row0.dataset.focus).toBe('true');

    // 0.7 beats 0.6 by only 0.1 — inside the hysteresis window, no switch.
    observer.emit([makeEntry(row1, 0.7)]);
    await nextFrame();
    expect(row0.dataset.focus).toBe('true');
    expect(row1.dataset.focus).toBeUndefined();
  });

  it('moves focus when a challenger beats the incumbent by more than 0.15', async () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    render(<Harness enabled={true} count={4} />);
    const observer = ControlledObserver.instances[0];
    const row0 = screen.getByTestId('row-0');
    const row1 = screen.getByTestId('row-1');

    observer.emit([makeEntry(row0, 0.6)]);
    await nextFrame();
    expect(row0.dataset.focus).toBe('true');

    observer.emit([makeEntry(row0, 0.3), makeEntry(row1, 1)]);
    await nextFrame();
    expect(row1.dataset.focus).toBe('true');
    expect(row0.dataset.focus).toBeUndefined();
  });

  it('breaks ratio ties by proximity to the band center', async () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    render(<Harness enabled={true} count={4} />);
    const observer = ControlledObserver.instances[0];
    const row0 = screen.getByTestId('row-0');
    const row1 = screen.getByTestId('row-1');

    // Band center is at 150 (rootBounds 0..300). row1 center (150) sits on
    // it; row0 center (50) is 100 away. Equal ratios → row1 wins.
    observer.emit([makeEntry(row0, 0.5, 0), makeEntry(row1, 0.5, 100)]);
    await nextFrame();
    expect(row1.dataset.focus).toBe('true');
    expect(row0.dataset.focus).toBeUndefined();
  });

  it('batches entries into a single animation frame', async () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    render(<Harness enabled={true} count={4} />);
    const observer = ControlledObserver.instances[0];
    const row0 = screen.getByTestId('row-0');
    const row1 = screen.getByTestId('row-1');

    // Two synchronous bursts before any frame — only the merged result lands.
    observer.emit([makeEntry(row0, 0.9)]);
    observer.emit([makeEntry(row0, 0.1), makeEntry(row1, 0.8)]);
    expect(row0.dataset.focus).toBeUndefined();
    await nextFrame();
    expect(row1.dataset.focus).toBe('true');
    expect(row0.dataset.focus).toBeUndefined();
  });

  it('disconnects the observer and clears the mark on teardown', async () => {
    window.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
    const { rerender } = render(<Harness enabled={true} count={4} />);
    const observer = ControlledObserver.instances[0];
    const row0 = screen.getByTestId('row-0');

    observer.emit([makeEntry(row0, 0.8)]);
    await nextFrame();
    expect(row0.dataset.focus).toBe('true');

    rerender(<Harness enabled={false} count={4} />);
    expect(observer.disconnect).toHaveBeenCalled();
    expect(row0.dataset.focus).toBeUndefined();
  });
});
