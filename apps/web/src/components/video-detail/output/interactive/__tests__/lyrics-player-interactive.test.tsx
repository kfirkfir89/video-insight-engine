import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { LyricsPlayerInteractive } from '../LyricsPlayerInteractive';

const sections = [
  {
    name: 'Verse 1',
    timestamp: 0,
    lines: [
      { line: 'Hello, it\'s me', timestamp: 0 },
      { line: 'I was wondering if after all these years', timestamp: 5 },
    ],
    analysis: 'Opens with a nostalgic tone.',
  },
  {
    name: 'Chorus',
    timestamp: 30,
    lines: [
      { line: 'Hello from the other side' },
    ],
  },
];

describe('LyricsPlayerInteractive', () => {
  it('should render the first section', () => {
    render(<LyricsPlayerInteractive sections={sections} />);
    // "Verse 1" appears in both SectionNav and section heading
    const verse1Elements = screen.getAllByText('Verse 1');
    expect(verse1Elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Hello, it's me")).toBeInTheDocument();
  });

  it('should return null for empty sections', () => {
    const { container } = render(<LyricsPlayerInteractive sections={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show artist when provided', () => {
    render(<LyricsPlayerInteractive sections={sections} artist="Adele" />);
    expect(screen.getByText('Adele')).toBeInTheDocument();
  });

  it('should show section navigation for multiple sections', () => {
    render(<LyricsPlayerInteractive sections={sections} />);
    const verse1Elements = screen.getAllByText('Verse 1');
    expect(verse1Elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Chorus')).toBeInTheDocument();
  });

  it('should show analysis in expandable card', () => {
    render(<LyricsPlayerInteractive sections={sections} />);
    expect(screen.getByText('Musical Analysis')).toBeInTheDocument();
  });

  it('should call onSeek when timestamp clicked', () => {
    const onSeek = vi.fn();
    render(<LyricsPlayerInteractive sections={sections} onSeek={onSeek} />);
    // Multiple timestamps may show "0:00" - click the first one
    const timestamps = screen.getAllByText('0:00');
    fireEvent.click(timestamps[0]);
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
