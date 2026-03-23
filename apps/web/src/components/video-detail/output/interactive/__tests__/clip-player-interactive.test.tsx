import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { ClipPlayerInteractive } from '../ClipPlayerInteractive';

const clips = [
  { label: 'Best moment', description: 'The peak of the video', startSeconds: 120, time: '2:00', mood: 'exciting', tags: ['highlight'] },
  { label: 'Key insight', startSeconds: 300, time: '5:00', mood: 'calm' },
  { label: 'Conclusion', startSeconds: 600, time: '10:00', mood: 'exciting' },
];

describe('ClipPlayerInteractive', () => {
  it('should render all clips', () => {
    render(<ClipPlayerInteractive clips={clips} />);
    expect(screen.getByText('Best moment')).toBeInTheDocument();
    expect(screen.getByText('Key insight')).toBeInTheDocument();
    expect(screen.getByText('Conclusion')).toBeInTheDocument();
  });

  it('should return null for empty clips', () => {
    const { container } = render(<ClipPlayerInteractive clips={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show timestamps', () => {
    render(<ClipPlayerInteractive clips={clips} />);
    expect(screen.getByText('2:00')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('should expand clip to show description', () => {
    render(<ClipPlayerInteractive clips={clips} />);
    fireEvent.click(screen.getByText('Best moment').closest('button')!);
    expect(screen.getByText('The peak of the video')).toBeInTheDocument();
  });

  it('should show mood filter when filters enabled and multiple moods', () => {
    render(<ClipPlayerInteractive clips={clips} filters />);
    expect(screen.getByText('All')).toBeInTheDocument();
    // "exciting" appears as filter button AND as mood badges on clips
    const excitingElements = screen.getAllByText('exciting');
    expect(excitingElements.length).toBeGreaterThanOrEqual(1);
  });
});
