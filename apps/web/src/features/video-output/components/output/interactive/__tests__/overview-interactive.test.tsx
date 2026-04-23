/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { OverviewInteractive } from '../OverviewInteractive';

describe('OverviewInteractive', () => {
  it('should render title', () => {
    render(<OverviewInteractive title="Trip to Japan" />);
    expect(screen.getByText('Trip to Japan')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    render(<OverviewInteractive title="Test" subtitle="A great overview" />);
    expect(screen.getByText('A great overview')).toBeInTheDocument();
  });

  it('should render stats', () => {
    render(
      <OverviewInteractive
        title="Test"
        stats={[
          { label: 'Duration', value: '7 days' },
          { label: 'Budget', value: '$3000' },
        ]}
      />,
    );
    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('$3000')).toBeInTheDocument();
  });

  it('should render highlights (collapsed by default; expand to view)', () => {
    render(
      <OverviewInteractive
        title="Test"
        highlights={[
          { emoji: '🏔️', text: 'Mount Fuji' },
          { emoji: '🍣', text: 'Sushi experience' },
        ]}
      />,
    );
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    // Highlights start collapsed for a calmer overview — click to reveal
    fireEvent.click(screen.getByText('Highlights'));
    expect(screen.getByText('Mount Fuji')).toBeInTheDocument();
  });

  it('should render tips (collapsed by default; expand to view)', () => {
    render(<OverviewInteractive title="Test" tips={['Book early', 'Learn basic phrases']} />);
    expect(screen.getByText('Tips')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tips'));
    expect(screen.getByText('Book early')).toBeInTheDocument();
  });

  it('should render summary', () => {
    render(<OverviewInteractive title="Test" summary="This is a great destination." />);
    expect(screen.getByText('This is a great destination.')).toBeInTheDocument();
  });

  it('should handle corrupt localStorage gracefully', () => {
    // Simulate corrupt localStorage data
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{"not":"an array"}');
    // Should not throw — corrupt data should be ignored
    expect(() => {
      render(
        <OverviewInteractive
          title="Test"
          videoId="test-video"
          highlights={[{ emoji: '🏔️', text: 'Mountain' }]}
        />,
      );
    }).not.toThrow();
    vi.restoreAllMocks();
  });
});
