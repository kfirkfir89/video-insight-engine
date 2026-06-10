import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { LyricsKaraoke, type LyricsSection } from '../LyricsKaraoke';

// jsdom doesn't implement scrollIntoView — stub it to prevent throws.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const sections: LyricsSection[] = [
  {
    name: 'Verse 1',
    timestamp: 0,
    lines: [
      { text: "Hello, it's me", timestamp: 0 },
      { text: 'I was wondering if after all these years', timestamp: 5 },
    ],
  },
  {
    name: 'Chorus',
    timestamp: 30,
    lines: [
      { text: 'Hello from the other side', timestamp: 30 },
      { text: 'I must have called a thousand times', timestamp: 35 },
    ],
  },
];

const untimedSections: LyricsSection[] = [
  {
    name: 'Verse',
    lines: [{ text: 'Just a plain lyric line' }, { text: 'And another one' }],
  },
];

describe('LyricsKaraoke', () => {
  it('should render all lyric lines', () => {
    render(<LyricsKaraoke sections={sections} />);
    expect(screen.getByText("Hello, it's me")).toBeInTheDocument();
    expect(
      screen.getByText('I was wondering if after all these years'),
    ).toBeInTheDocument();
    expect(screen.getByText('Hello from the other side')).toBeInTheDocument();
    expect(
      screen.getByText('I must have called a thousand times'),
    ).toBeInTheDocument();
  });

  it('renders an empty state when no lines are provided', () => {
    const { container } = render(<LyricsKaraoke sections={[]} />);
    expect(container.textContent).toContain('No lyrics were extracted');
  });

  it('should mark the line whose timestamp range contains currentTime as active', () => {
    render(<LyricsKaraoke sections={sections} currentTime={7} />);
    // currentTime=7 → line at ts=5 is active (next line at ts=30)
    const activeLine = screen
      .getByText('I was wondering if after all these years')
      .closest('li');
    expect(activeLine).toHaveAttribute('data-active', 'true');
    expect(activeLine).toHaveAttribute('data-line-state', 'active');

    // The previous line should be marked "past"
    const pastLine = screen.getByText("Hello, it's me").closest('li');
    expect(pastLine).toHaveAttribute('data-line-state', 'past');

    // Upcoming line
    const upcomingLine = screen
      .getByText('Hello from the other side')
      .closest('li');
    expect(upcomingLine).toHaveAttribute('data-line-state', 'upcoming');
  });

  it('should call onSeek with section timestamp when a section nav button is clicked', () => {
    const onSeek = vi.fn();
    render(<LyricsKaraoke sections={sections} onSeek={onSeek} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chorus' }));
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it('should fall back to plain text rendering when no timestamps are provided', () => {
    render(<LyricsKaraoke sections={untimedSections} />);
    expect(screen.getByText('Just a plain lyric line')).toBeInTheDocument();
    // No line is marked active when there are no timestamps.
    const line = screen.getByText('Just a plain lyric line').closest('li');
    expect(line).not.toHaveAttribute('data-active');
    expect(line).toHaveAttribute('data-line-state', 'upcoming');
  });

  it('should call onSeek with the line timestamp when a timed line is clicked', () => {
    const onSeek = vi.fn();
    render(<LyricsKaraoke sections={sections} onSeek={onSeek} />);
    fireEvent.click(screen.getByText("Hello, it's me"));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('should display the artist when provided', () => {
    render(<LyricsKaraoke sections={sections} artist="Adele" />);
    expect(screen.getByText('Adele')).toBeInTheDocument();
  });
});
