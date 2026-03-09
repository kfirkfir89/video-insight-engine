import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { VideoResponse, VideoOutput } from '@vie/types';

// Mock child components to isolate OutputRouter behavior.
vi.mock('@/components/video-detail/output/OutputShell', () => ({
  OutputShell: (props: Record<string, unknown>) => (
    <div data-testid="output-shell" data-video-id={(props.video as VideoResponse)?.videoId}>
      OutputShell
    </div>
  ),
}));

// Import after mocks are set up
import { OutputRouter } from '@/components/video-detail/OutputRouter';

const mockVideo: VideoResponse = {
  videoId: 'test-video-123',
  youtubeId: 'dQw4w9WgXcQ',
  title: 'Test Video Title',
  channelTitle: 'Test Channel',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  status: 'completed',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
} as VideoResponse;

const mockOutput: VideoOutput = {
  outputType: 'explanation',
  intent: {
    outputType: 'explanation',
    confidence: 0.95,
    userGoal: 'Understand the video content',
    sections: [
      { id: 'key-points', label: 'Key Points', emoji: '📌', description: 'Main points' },
    ],
  },
  output: {
    type: 'explanation',
    data: {
      keyPoints: [{ emoji: '1', title: 'Point 1', detail: 'Detail' }],
      concepts: [],
      takeaways: ['Takeaway 1'],
      timestamps: [],
    },
  },
  synthesis: {
    tldr: 'Quick summary',
    keyTakeaways: ['Takeaway'],
    masterSummary: 'Full summary',
    seoDescription: 'SEO text',
  },
};

describe('OutputRouter', () => {
  it('should render OutputShell when output is provided', () => {
    render(
      <OutputRouter
        video={mockVideo}
        output={mockOutput}
      />,
    );

    expect(screen.getByTestId('output-shell')).toBeInTheDocument();
  });

  it('should pass video prop to OutputShell', () => {
    render(
      <OutputRouter
        video={mockVideo}
        output={mockOutput}
      />,
    );

    const shell = screen.getByTestId('output-shell');
    expect(shell).toHaveAttribute('data-video-id', 'test-video-123');
  });

  it('should return null when output is null', () => {
    const { container } = render(
      <OutputRouter
        video={mockVideo}
        output={null}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should pass isStreaming to OutputShell', () => {
    render(
      <OutputRouter
        video={mockVideo}
        output={mockOutput}
        isStreaming={true}
      />,
    );

    expect(screen.getByTestId('output-shell')).toBeInTheDocument();
  });
});
