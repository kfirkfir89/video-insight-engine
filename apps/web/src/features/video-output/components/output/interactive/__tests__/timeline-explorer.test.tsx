import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { TimelineExplorer } from '../TimelineExplorer';

const entries = [
  { time: '0:00', seconds: 0, label: 'Introduction', description: 'Welcome to the video', mood: 'calm' },
  { time: '2:30', seconds: 150, label: 'Main Topic', speaker: 'John', mood: 'excited' },
  { time: '5:00', seconds: 300, label: 'Conclusion', mood: 'calm' },
];

describe('TimelineExplorer', () => {
  it('should render all entries', () => {
    render(<TimelineExplorer entries={entries} />);
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Main Topic')).toBeInTheDocument();
    expect(screen.getByText('Conclusion')).toBeInTheDocument();
  });

  it('should return null for empty entries', () => {
    const { container } = render(<TimelineExplorer entries={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show timestamps', () => {
    render(<TimelineExplorer entries={entries} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('2:30')).toBeInTheDocument();
  });

  it('should show speaker when present', () => {
    render(<TimelineExplorer entries={entries} />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('should show mood badges', () => {
    render(<TimelineExplorer entries={entries} />);
    const calmBadges = screen.getAllByText('calm');
    expect(calmBadges.length).toBeGreaterThan(0);
  });

  it('should show mood filter pills when multiple moods', () => {
    render(<TimelineExplorer entries={entries} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    // Filter buttons for moods
    const filterBtns = screen.getAllByRole('button');
    expect(filterBtns.length).toBeGreaterThan(1);
  });

  it('should expand entry on click to show description', () => {
    render(<TimelineExplorer entries={entries} />);
    fireEvent.click(screen.getByText('Introduction'));
    expect(screen.getByText('Welcome to the video')).toBeInTheDocument();
  });

  it('should call onSeek when timestamp clicked', () => {
    const onSeek = vi.fn();
    render(<TimelineExplorer entries={entries} onSeek={onSeek} />);
    fireEvent.click(screen.getByText('0:00'));
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
