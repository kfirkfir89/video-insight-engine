import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VideoHero } from '../VideoHero';

const DEFAULT_PROPS = {
  title: 'Test Video Title',
  creator: 'Test Channel',
  duration: 754,
  tldr: 'A short summary of the video content.',
  keyTakeaways: ['Takeaway one', 'Takeaway two', 'Takeaway three'],
  masterSummary: 'A comprehensive overview of the entire video.',
  youtubeId: 'dQw4w9WgXcQ',
};

// The component uses setTimeout for flip animation (200ms midpoint, 500ms total).
// We use fake timers to control the animation timing in tests.
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe('VideoHero', () => {
  it('should render title, creator, and duration', () => {
    render(<VideoHero {...DEFAULT_PROPS} />);

    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
    expect(screen.getByText('12:34')).toBeInTheDocument();
  });

  it('should start collapsed and expand on click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    const expandBtn = screen.getByRole('button', { name: /expand hero/i });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandBtn);
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('should show TLDR text when expanded', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    expect(screen.getByText(DEFAULT_PROPS.tldr)).toBeInTheDocument();
  });

  it('should show Watch Video and Key Takeaways buttons when expanded', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    expect(screen.getByText('Watch Video')).toBeInTheDocument();
    expect(screen.getByText('Key Takeaways')).toBeInTheDocument();
  });

  it('should flip to takeaways face when Key Takeaways button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Key Takeaways'));

    // Advance past the midpoint (200ms) so the content swaps
    vi.advanceTimersByTime(250);

    await waitFor(() => {
      expect(screen.getByText('Takeaway one')).toBeInTheDocument();
      expect(screen.getByText('Takeaway two')).toBeInTheDocument();
    });
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('should flip to overview face when Overview button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    // Expand → Takeaways → Overview
    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Key Takeaways'));
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Overview'));
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText(DEFAULT_PROPS.masterSummary)).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  it('should return to front face and collapse when Close is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    // Expand → Takeaways → Overview → Close
    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Key Takeaways'));
    vi.advanceTimersByTime(600);

    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument());
    await user.click(screen.getByText('Overview'));
    vi.advanceTimersByTime(600);

    await waitFor(() => expect(screen.getByText('Close')).toBeInTheDocument());
    await user.click(screen.getByText('Close'));
    vi.advanceTimersByTime(600);

    // Should be back to collapsed front
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand hero/i })).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('should open video modal when Watch Video is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Watch Video'));

    expect(screen.getByRole('dialog', { name: /video player/i })).toBeInTheDocument();
  });

  it('should close video modal when Close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Watch Video'));

    await user.click(screen.getByRole('button', { name: /close video/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should handle missing optional props gracefully', () => {
    render(<VideoHero title="Minimal Video" />);
    expect(screen.getByText('Minimal Video')).toBeInTheDocument();
  });

  it('should format hours correctly', () => {
    render(<VideoHero title="Long Video" duration={7265} />);
    expect(screen.getByText('2:01:05')).toBeInTheDocument();
  });

  it('should not show Watch Video button without youtubeId', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} youtubeId={undefined} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    expect(screen.queryByText('Watch Video')).not.toBeInTheDocument();
  });

  it('should not show Key Takeaways button without takeaways', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} keyTakeaways={[]} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    expect(screen.queryByText('Key Takeaways')).not.toBeInTheDocument();
  });

  it('should not show Overview button without masterSummary', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} masterSummary={undefined} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Key Takeaways'));
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
  });

  it('should flip back from takeaways to front when Back is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VideoHero {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /expand hero/i }));
    await user.click(screen.getByText('Key Takeaways'));
    vi.advanceTimersByTime(600);

    await waitFor(() => expect(screen.getByText('Back')).toBeInTheDocument());
    await user.click(screen.getByText('Back'));
    vi.advanceTimersByTime(600);

    // Should be back at collapsed front
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand hero/i })).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
