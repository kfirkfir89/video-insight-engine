import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { VideoHero } from '../VideoHero';
import { VideoPlayerProvider } from '@/features/video-output/contexts/VideoPlayerContext';

const DEFAULT_PROPS = {
  title: 'Test Video Title',
  creator: 'Test Channel',
  duration: 754,
  tldr: 'A short summary of the video content.',
  keyTakeaways: ['Takeaway one', 'Takeaway two', 'Takeaway three'],
  masterSummary: 'A comprehensive overview of the entire video.',
  youtubeId: 'dQw4w9WgXcQ',
};

const SAMPLE_TABS = [
  { id: 'overview', label: 'Overview', emoji: '📚', dataSource: '' },
  { id: 'key_points', label: 'Key Points', emoji: '🎯', dataSource: '' },
  { id: 'quizzes', label: 'Quizzes', emoji: '✅', dataSource: '' },
];

function renderWithPlayer(ui: ReactNode): ReturnType<typeof render> {
  return render(<VideoPlayerProvider>{ui}</VideoPlayerProvider>);
}

describe('VideoHero', () => {
  it('should render title, creator, and duration', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
    expect(screen.getByText('12:34')).toBeInTheDocument();
  });

  it('should render the TLDR inline (no expand step)', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    expect(screen.getByText(DEFAULT_PROPS.tldr)).toBeInTheDocument();
  });

  it('should render a Watch button when youtubeId is provided', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: /watch/i })).toBeInTheDocument();
  });

  it('should toggle Watch → Hide and flip aria-expanded when clicked', async () => {
    const user = userEvent.setup();
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    const watchBtn = screen.getByRole('button', { name: /watch/i });
    expect(watchBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(watchBtn);

    const hideBtn = screen.getByRole('button', { name: /hide/i });
    expect(hideBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('should render a tab bar when tabs are provided', () => {
    renderWithPlayer(
      <VideoHero {...DEFAULT_PROPS} tabs={SAMPLE_TABS} activeTabId="overview" onTabSelect={() => {}} />,
    );

    expect(screen.getByRole('tablist', { name: /video insight sections/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(SAMPLE_TABS.length);
  });

  it('should mark the active tab with aria-selected=true', () => {
    renderWithPlayer(
      <VideoHero {...DEFAULT_PROPS} tabs={SAMPLE_TABS} activeTabId="key_points" onTabSelect={() => {}} />,
    );

    const active = screen.getByRole('tab', { selected: true });
    expect(active).toHaveTextContent('Key Points');
  });

  it('should fire onTabSelect with the tab id when a tab is clicked', async () => {
    const onTabSelect = vi.fn();
    const user = userEvent.setup();
    renderWithPlayer(
      <VideoHero {...DEFAULT_PROPS} tabs={SAMPLE_TABS} activeTabId="overview" onTabSelect={onTabSelect} />,
    );

    await user.click(screen.getByRole('tab', { name: /quizzes/i }));

    expect(onTabSelect).toHaveBeenCalledWith('quizzes');
  });

  it('should not render a tab bar when no tabs are provided', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('should apply the domain gradient to the active tab', () => {
    const gradient = 'linear-gradient(135deg, oklch(70% 0.2 280), oklch(60% 0.2 320))';
    renderWithPlayer(
      <VideoHero
        {...DEFAULT_PROPS}
        tabs={SAMPLE_TABS}
        activeTabId="overview"
        onTabSelect={() => {}}
        domainGradient={gradient}
      />,
    );

    const active = screen.getByRole('tab', { selected: true });
    expect(active.getAttribute('style') ?? '').toContain('linear-gradient');
  });

  it('should handle missing optional props gracefully', () => {
    renderWithPlayer(<VideoHero title="Minimal Video" />);
    expect(screen.getByText('Minimal Video')).toBeInTheDocument();
  });

  it('should format hours correctly', () => {
    renderWithPlayer(<VideoHero title="Long Video" duration={7265} />);
    expect(screen.getByText('2:01:05')).toBeInTheDocument();
  });

  it('should not render the Watch button without youtubeId', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} youtubeId={undefined} />);

    expect(screen.queryByRole('button', { name: /watch/i })).not.toBeInTheDocument();
  });

  it('should show a placeholder while TLDR is loading', () => {
    const { container } = renderWithPlayer(<VideoHero title="Loading test" />);

    expect(screen.getByText('Loading test')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"].animate-pulse')).toBeInTheDocument();
  });

  it('should expose the title with an aria-labelledby section', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    const section = screen.getByRole('region', { name: /test video title/i });
    expect(section).toBeInTheDocument();
  });
});
