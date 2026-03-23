import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { FlashDeckInteractive } from '../FlashDeckInteractive';

const cards = [
  { front: 'What is React?', back: 'A UI library', emoji: '⚛️' },
  { front: 'What is JSX?', back: 'JavaScript XML syntax', category: 'Syntax' },
];

describe('FlashDeckInteractive', () => {
  it('should render the first card front', () => {
    render(<FlashDeckInteractive cards={cards} />);
    expect(screen.getByText('What is React?')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Tap to flip')).toBeInTheDocument();
  });

  it('should return null for empty cards', () => {
    const { container } = render(<FlashDeckInteractive cards={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should flip card on click', () => {
    render(<FlashDeckInteractive cards={cards} />);
    const flipTarget = screen.getByLabelText('What is React?');
    fireEvent.click(flipTarget);
    expect(screen.getByText('A UI library')).toBeInTheDocument();
  });

  it('should show Got it / Review again buttons after flip', () => {
    render(<FlashDeckInteractive cards={cards} />);
    fireEvent.click(screen.getByLabelText('What is React?'));
    expect(screen.getByText('Got it!')).toBeInTheDocument();
    expect(screen.getByText('Review again')).toBeInTheDocument();
  });

  it('should show shuffle button when shuffleable', () => {
    render(<FlashDeckInteractive cards={cards} shuffleable />);
    expect(screen.getByLabelText('Shuffle cards')).toBeInTheDocument();
  });

  it('should show navigation for multiple cards', () => {
    render(<FlashDeckInteractive cards={cards} />);
    // BackForward component renders buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
