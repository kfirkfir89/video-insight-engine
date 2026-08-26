/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { OverviewInteractive } from '../OverviewInteractive';

describe('OverviewInteractive', () => {
  it('should not render title/subtitle/summary/masterSummary even when passed (page hero owns them)', () => {
    render(
      <OverviewInteractive
        title="Trip to Japan"
        subtitle="An incredible adventure"
        summary="A long-form trip overview that would duplicate the page hero."
        masterSummary="Even longer masterSummary content."
        keyTakeaways={['Bring cash for rural areas']}
      />,
    );
    expect(screen.queryByText('Trip to Japan')).not.toBeInTheDocument();
    expect(screen.queryByText('An incredible adventure')).not.toBeInTheDocument();
    expect(screen.queryByText(/A long-form trip overview/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Even longer masterSummary/)).not.toBeInTheDocument();
  });

  it('should render an inline metadata strip when level/duration/itemCount are provided', () => {
    render(<OverviewInteractive level="Advanced" duration="45 min" itemCount={8} />);
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should not render a top "Key takeaways" block (the page hero owns takeaways 1-6)', () => {
    render(
      <OverviewInteractive
        keyTakeaways={['First insight', 'Second insight', 'Third insight']}
      />,
    );
    // The hero (above the tab) owns the takeaways. Rendering them here too
    // produced a duplicate stack — see the design-rule compliance critique.
    expect(screen.queryByText('Key takeaways')).not.toBeInTheDocument();
    expect(screen.queryByText('First insight')).not.toBeInTheDocument();
  });

  it('should render cross-tab navigation grid with labels and counts', () => {
    const onNavigateTab = vi.fn();
    render(
      <OverviewInteractive
        crossTabLinks={[
          { targetTab: 'concepts', label: 'Concepts', count: 9, emoji: '🧠' },
          { targetTab: 'quizzes', label: 'Quizzes', count: 6, emoji: '🧪' },
        ]}
        onNavigateTab={onNavigateTab}
      />,
    );
    expect(screen.getByText('Continue exploring')).toBeInTheDocument();
    expect(screen.getByText('Concepts')).toBeInTheDocument();
    expect(screen.getByText('Quizzes')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Concepts' }));
    expect(onNavigateTab).toHaveBeenCalledWith('concepts');
  });

  it('should not render the cross-tab grid when crossTabLinks is empty', () => {
    render(<OverviewInteractive keyTakeaways={['Only takeaway']} onNavigateTab={vi.fn()} />);
    expect(screen.queryByText('Continue exploring')).not.toBeInTheDocument();
  });

  it('should fall back to keyTakeaways.slice(3) as "More takeaways" when highlights is empty', () => {
    render(
      <OverviewInteractive
        keyTakeaways={['Top A', 'Top B', 'Top C', 'Extra 1', 'Extra 2']}
      />,
    );
    expect(screen.getByText('More takeaways')).toBeInTheDocument();
    // Extra takeaways are visible by default — no expand click required.
    expect(screen.getByText('Extra 1')).toBeInTheDocument();
    expect(screen.getByText('Extra 2')).toBeInTheDocument();
  });

  it('should not show the collapsible at all when there are no highlights and no extra takeaways', () => {
    render(<OverviewInteractive keyTakeaways={['Only A', 'Only B', 'Only C']} />);
    expect(screen.queryByText('More takeaways')).not.toBeInTheDocument();
    expect(screen.queryByText('Highlights')).not.toBeInTheDocument();
  });

  it('should prefer curated highlights over the keyTakeaways fallback when both are present', () => {
    render(
      <OverviewInteractive
        keyTakeaways={['Top A', 'Top B', 'Top C', 'Extra fallback only']}
        highlights={[
          { emoji: '🔥', text: 'Curated highlight one' },
          { emoji: '🧩', text: 'Curated highlight two' },
        ]}
      />,
    );
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.queryByText('More takeaways')).not.toBeInTheDocument();
    // Highlights are visible by default — no expand click required.
    expect(screen.getByText('Curated highlight one')).toBeInTheDocument();
    // The fallback content should not leak through when curated highlights win.
    expect(screen.queryByText('Extra fallback only')).not.toBeInTheDocument();
  });

  it('should render tips visible by default', () => {
    render(<OverviewInteractive tips={['Book early', 'Learn basic phrases']} />);
    expect(screen.getByText('Tips')).toBeInTheDocument();
    // Tips content is expanded by default — no click needed to read it.
    expect(screen.getByText('Book early')).toBeInTheDocument();
  });

  it('should render nothing when no usable content is provided', () => {
    const { container } = render(<OverviewInteractive />);
    expect(container.firstChild).toBeNull();
  });

  it('should handle corrupt localStorage gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{"not":"an array"}');
    expect(() => {
      render(
        <OverviewInteractive
          videoId="test-video"
          highlights={[{ emoji: '🏔️', text: 'Mountain' }]}
        />,
      );
    }).not.toThrow();
    vi.restoreAllMocks();
  });
});
