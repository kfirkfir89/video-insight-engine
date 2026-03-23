import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Celebration } from '../Celebration';

describe('Celebration', () => {
  it('should render emoji and title', () => {
    const emoji = '\u{1F389}';
    render(<Celebration emoji={emoji} title="Great job!" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Great job!')).toBeInTheDocument();
    // Emoji is aria-hidden, check the span is in the DOM
    const alert = screen.getByRole('alert');
    const emojiSpan = alert.querySelector('[aria-hidden="true"]');
    expect(emojiSpan).toBeInTheDocument();
    expect(emojiSpan?.textContent).toBe(emoji);
  });

  it('should render subtitle when provided', () => {
    render(<Celebration emoji="\u{1F389}" title="Done!" subtitle="You finished everything." />);

    expect(screen.getByText('You finished everything.')).toBeInTheDocument();
  });

  it('should not render subtitle when not provided', () => {
    render(<Celebration emoji="\u{1F389}" title="Done!" />);

    // Only the title h3 and emoji span should be present, no p tag
    const alert = screen.getByRole('alert');
    expect(alert.querySelector('p')).toBeNull();
  });

  it('should render next-tab button when all props provided', () => {
    const onNavigateTab = vi.fn();
    render(
      <Celebration
        emoji="\u{1F389}"
        title="Done!"
        nextTabId="quiz"
        nextLabel="Take the quiz"
        onNavigateTab={onNavigateTab}
      />
    );

    const button = screen.getByRole('button', { name: /take the quiz/i });
    expect(button).toBeInTheDocument();
  });

  it('should call onNavigateTab when next button clicked', () => {
    const onNavigateTab = vi.fn();
    render(
      <Celebration
        emoji="\u{1F389}"
        title="Done!"
        nextTabId="quiz"
        nextLabel="Take the quiz"
        onNavigateTab={onNavigateTab}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /take the quiz/i }));

    expect(onNavigateTab).toHaveBeenCalledWith('quiz');
  });

  it('should not render next button without onNavigateTab', () => {
    render(
      <Celebration
        emoji="\u{1F389}"
        title="Done!"
        nextTabId="quiz"
        nextLabel="Take the quiz"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should have alert role for accessibility', () => {
    render(<Celebration emoji="\u{1F389}" title="Done!" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
