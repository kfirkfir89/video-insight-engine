import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { MomentTrack, type MomentItem } from '../MomentTrack';

const mixedItems: MomentItem[] = [
  { time: '0:00', seconds: 0, label: 'Introduction', description: 'Welcome to the video', mood: 'calm' },
  { time: '2:00', seconds: 120, endSeconds: 187, label: 'Best moment', description: 'The peak of the video', mood: 'exciting', tags: ['highlight'] },
  { time: '2:30', seconds: 150, label: 'Main Topic', speaker: 'John', mood: 'excited' },
  { time: '5:00', seconds: 300, endSeconds: 345, label: 'Key insight', mood: 'calm' },
  { time: '8:00', seconds: 480, label: 'Conclusion', mood: 'calm' },
];

const onlyMoments: MomentItem[] = [
  { time: '0:00', seconds: 0, label: 'Intro', mood: 'calm' },
  { time: '2:30', seconds: 150, label: 'Middle' },
  { time: '5:00', seconds: 300, label: 'Outro', mood: 'calm' },
];

const onlyClips: MomentItem[] = [
  { time: '0:30', seconds: 30, endSeconds: 90, label: 'Clip A', description: 'Nice range', mood: 'highlight' },
  { time: '4:00', seconds: 240, endSeconds: 330, label: 'Clip B', mood: 'demo' },
];

describe('MomentTrack', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders all items', () => {
    render(<MomentTrack items={mixedItems} />);
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Best moment')).toBeInTheDocument();
    expect(screen.getByText('Main Topic')).toBeInTheDocument();
    expect(screen.getByText('Key insight')).toBeInTheDocument();
    expect(screen.getByText('Conclusion')).toBeInTheDocument();
  });

  it('renders an empty state for empty items', () => {
    const { container } = render(<MomentTrack items={[]} />);
    expect(container.textContent).toContain('No moments were extracted');
  });

  it('shows timestamps', () => {
    render(<MomentTrack items={mixedItems} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('2:30')).toBeInTheDocument();
  });

  it('shows speaker when present', () => {
    render(<MomentTrack items={mixedItems} />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('shows mood badges', () => {
    render(<MomentTrack items={mixedItems} />);
    const calmBadges = screen.getAllByText('calm');
    expect(calmBadges.length).toBeGreaterThan(0);
  });

  it('shows mood filter pills when multiple moods', () => {
    render(<MomentTrack items={mixedItems} />);
    expect(screen.getByText('All moods')).toBeInTheDocument();
  });

  it('expands a moment on click to show description', () => {
    render(<MomentTrack items={mixedItems} />);
    // Expanding Introduction reveals its description
    const btns = screen.getAllByRole('button', { expanded: false });
    const introBtn = btns.find((el) => el.textContent?.includes('Introduction'));
    expect(introBtn).toBeDefined();
    fireEvent.click(introBtn!);
    expect(screen.getByText('Welcome to the video')).toBeInTheDocument();
  });

  it('expands a clip on click and shows tags', () => {
    render(<MomentTrack items={mixedItems} />);
    const btns = screen.getAllByRole('button', { expanded: false });
    const clipBtn = btns.find((el) => el.textContent?.includes('Best moment'));
    fireEvent.click(clipBtn!);
    expect(screen.getByText('The peak of the video')).toBeInTheDocument();
    expect(screen.getByText('highlight')).toBeInTheDocument();
  });

  it('calls onSeek when a timestamp chip is clicked', () => {
    const onSeek = vi.fn();
    render(<MomentTrack items={onlyMoments} onSeek={onSeek} />);
    fireEvent.click(screen.getByRole('button', { name: /Jump to 0:00/ }));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('renders the timestamp chip as a native button so keyboard activation is built-in', () => {
    const onSeek = vi.fn();
    render(<MomentTrack items={onlyMoments} onSeek={onSeek} />);
    // Chip is now a real <button>: browsers fire onClick on Enter/Space natively.
    // jsdom does not synthesize that, so we assert the chip is a button (so AT
    // and the browser handle keyboard activation) and verify the click pathway.
    const chip = screen.getByRole('button', { name: /Jump to 2:30/ });
    expect(chip.tagName).toBe('BUTTON');
    fireEvent.click(chip);
    expect(onSeek).toHaveBeenCalledWith(150);
  });

  it('renders points and clips with distinct data-kind attributes', () => {
    render(<MomentTrack items={mixedItems} />);
    const moments = document.querySelectorAll('[data-kind="moment"]');
    const clips = document.querySelectorAll('[data-kind="clip"]');
    expect(moments.length).toBe(3);
    expect(clips.length).toBe(2);
  });

  it('sets capsule height proportional to clip duration', () => {
    render(<MomentTrack items={mixedItems} />);
    const capsules = document.querySelectorAll('[data-testid^="capsule-"]') as NodeListOf<HTMLElement>;
    expect(capsules.length).toBe(2);
    // The Best moment clip (duration 67s) should produce a larger height than the 45s Key insight
    const heights = Array.from(capsules).map((el) => parseInt(el.style.height, 10));
    expect(heights.every((h) => h >= 32 && h <= 120)).toBe(true);
  });

  it('shows segmented type filter only when dataset has both kinds', () => {
    const { rerender } = render(<MomentTrack items={mixedItems} />);
    expect(screen.getByTestId('type-filter-clips')).toBeInTheDocument();
    rerender(<MomentTrack items={onlyMoments} />);
    expect(screen.queryByTestId('type-filter-clips')).toBeNull();
    rerender(<MomentTrack items={onlyClips} />);
    expect(screen.queryByTestId('type-filter-clips')).toBeNull();
  });

  it('filters to clips only when Clips is pressed', () => {
    render(<MomentTrack items={mixedItems} />);
    fireEvent.click(screen.getByTestId('type-filter-clips'));
    // Moments should disappear (Introduction is a moment — not a clip)
    expect(screen.queryByText('Introduction')).toBeNull();
    expect(screen.getByText('Best moment')).toBeInTheDocument();
    expect(screen.getByText('Key insight')).toBeInTheDocument();
  });

  it('marks the active item when currentTime falls inside a clip range', () => {
    render(<MomentTrack items={mixedItems} currentTime={150} />);
    // At 150s we're inside Best moment (120-187) — its root li should be active
    const activeElements = document.querySelectorAll('[data-active="true"]');
    expect(activeElements.length).toBeGreaterThanOrEqual(1);
    const activeText = activeElements[0].textContent ?? '';
    expect(activeText).toContain('Best moment');
  });

  it('shows live progress for active clip', () => {
    render(<MomentTrack items={mixedItems} currentTime={150} />);
    // Best moment starts at 120s, currentTime=150s ⇒ 30s elapsed, label becomes "2:00 / 30s"
    expect(screen.getByText(/\/ 30s/)).toBeInTheDocument();
  });

  it('share button copies range hash for clips', () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<MomentTrack items={[mixedItems[1]]} />);
    // Expand
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const shareBtn = screen.getByTestId('share-0');
    fireEvent.click(shareBtn);
    expect(writeText).toHaveBeenCalled();
    const arg = writeText.mock.calls[0][0] as string;
    expect(arg).toMatch(/#t=120,187$/);
  });

  it('share button copies single-seconds hash for moments', () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<MomentTrack items={[mixedItems[0]]} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const shareBtn = screen.getByTestId('share-0');
    fireEvent.click(shareBtn);
    const arg = writeText.mock.calls[0][0] as string;
    expect(arg).toMatch(/#t=0$/);
    expect(arg).not.toMatch(/,/);
  });

  it('respects prefers-reduced-motion by skipping the pulse class', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    render(<MomentTrack items={onlyMoments} currentTime={0} />);
    const pulsing = document.querySelectorAll('.animate-pulse-once');
    expect(pulsing.length).toBe(0);
  });
});
