import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('should show skeleton placeholders for brief and takeaways while streaming', () => {
    const { container } = renderWithPlayer(<VideoHero title="Loading test" />);

    expect(screen.getByText('Loading test')).toBeInTheDocument();
    // Any pulsing placeholder div is fine — the test asserts the streaming
    // state is visually represented, not the exact selector shape.
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should expose the title with an aria-labelledby section', () => {
    renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

    const section = screen.getByRole('region', { name: /test video title/i });
    expect(section).toBeInTheDocument();
  });

  describe('Briefing Surface (Hero owns the Overview)', () => {
    it('should render the identity strip with domain label when primaryTag is provided', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} primaryTag="learning" />);
      // Domain label appears in the identity strip, joined by dots with the
      // other metadata fields.
      expect(screen.getByText('Learning')).toBeInTheDocument();
      expect(screen.getByText('12:34')).toBeInTheDocument();
      expect(screen.getByText('Test Channel')).toBeInTheDocument();
    });

    it('should render an optional level chip in the identity strip', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} primaryTag="tech" level="Advanced" />);
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    it('should render a Brief eyebrow above the TLDR', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);
      expect(screen.getByText('Brief')).toBeInTheDocument();
      expect(screen.getByText(DEFAULT_PROPS.tldr)).toBeInTheDocument();
    });

    it('should render Key takeaways block when takeaways are present', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);
      expect(screen.getByText('Key takeaways')).toBeInTheDocument();
      expect(screen.getByText('Takeaway one')).toBeInTheDocument();
      expect(screen.getByText('Takeaway two')).toBeInTheDocument();
      expect(screen.getByText('Takeaway three')).toBeInTheDocument();
    });

    it('should cap takeaways at six visible items', () => {
      const tooMany = Array.from({ length: 9 }, (_, i) => `Takeaway ${i + 1}`);
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} keyTakeaways={tooMany} />);
      expect(screen.getByText('Takeaway 6')).toBeInTheDocument();
      expect(screen.queryByText('Takeaway 7')).not.toBeInTheDocument();
    });

    it('should not render the Key takeaways block when none are present and not streaming', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} keyTakeaways={undefined} />);
      expect(screen.queryByText('Key takeaways')).not.toBeInTheDocument();
    });

    it('should render the YouTube outbound link when youtubeId is provided', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: /youtube/i });
      expect(link).toHaveAttribute('href', `https://youtu.be/${DEFAULT_PROPS.youtubeId}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  describe('Collapsible Brief and Key takeaways', () => {
    beforeEach(() => {
      // Each test starts with no persisted preference so the default-open
      // behavior is exercised explicitly.
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should default to expanded when no localStorage preference is set', () => {
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

      const briefBtn = screen.getByRole('button', { name: /brief/i });
      const takeawaysBtn = screen.getByRole('button', { name: /key takeaways/i });

      expect(briefBtn).toHaveAttribute('aria-expanded', 'true');
      expect(takeawaysBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse the Brief when the brief toggle is clicked', async () => {
      const user = userEvent.setup();
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

      const briefBtn = screen.getByRole('button', { name: /brief/i });
      await user.click(briefBtn);

      expect(briefBtn).toHaveAttribute('aria-expanded', 'false');
      // Takeaways stay open — the toggles are independent.
      expect(screen.getByRole('button', { name: /key takeaways/i })).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse the Key takeaways when its toggle is clicked', async () => {
      const user = userEvent.setup();
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

      const takeawaysBtn = screen.getByRole('button', { name: /key takeaways/i });
      await user.click(takeawaysBtn);

      expect(takeawaysBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: /brief/i })).toHaveAttribute('aria-expanded', 'true');
    });

    it('should persist the toggle state to localStorage', async () => {
      const user = userEvent.setup();
      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

      await user.click(screen.getByRole('button', { name: /brief/i }));

      expect(localStorage.getItem('vie-hero-brief-open')).toBe('false');
    });

    it('should restore the collapsed state from localStorage on mount', () => {
      localStorage.setItem('vie-hero-brief-open', 'false');
      localStorage.setItem('vie-hero-takeaways-open', 'false');

      renderWithPlayer(<VideoHero {...DEFAULT_PROPS} />);

      expect(screen.getByRole('button', { name: /brief/i })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: /key takeaways/i })).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
