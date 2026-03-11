import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrossTabLink } from '../CrossTabLink';

describe('CrossTabLink', () => {
  it('should render label text', () => {
    render(<CrossTabLink tabId="quiz" label="Take the quiz" onNavigate={vi.fn()} />);

    expect(screen.getByText('Take the quiz')).toBeInTheDocument();
  });

  it('should call onNavigate with tabId when clicked', () => {
    const onNavigate = vi.fn();
    render(<CrossTabLink tabId="quiz" label="Take the quiz" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onNavigate).toHaveBeenCalledWith('quiz');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('should render as a button element', () => {
    render(<CrossTabLink tabId="quiz" label="Take the quiz" onNavigate={vi.fn()} />);

    expect(screen.getByRole('button')).toBeInstanceOf(HTMLButtonElement);
  });

  it('should render chevron icon', () => {
    const { container } = render(
      <CrossTabLink tabId="quiz" label="Take the quiz" onNavigate={vi.fn()} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
