import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlashCard } from '../FlashCard';

const createCards = () => [
  { front: 'What is React?', back: 'A JavaScript library for building UIs', emoji: '\u{269B}\u{FE0F}', category: 'Fundamentals' },
  { front: 'What is JSX?', back: 'A syntax extension for JavaScript', category: 'Syntax' },
  { front: 'What is a hook?', back: 'A function to use state in functional components' },
];

describe('FlashCard', () => {
  describe('rendering', () => {
    it('should render the first card front', () => {
      render(<FlashCard cards={createCards()} />);

      expect(screen.getByText('What is React?')).toBeInTheDocument();
    });

    it('should render card counter', () => {
      render(<FlashCard cards={createCards()} />);

      expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
    });

    it('should render emoji when provided', () => {
      render(<FlashCard cards={createCards()} />);

      expect(screen.getByText('\u{269B}\u{FE0F}')).toBeInTheDocument();
    });

    it('should render category when provided', () => {
      render(<FlashCard cards={createCards()} />);

      expect(screen.getByText('Fundamentals')).toBeInTheDocument();
    });

    it('should render tap to flip hint', () => {
      render(<FlashCard cards={createCards()} />);

      expect(screen.getByText('Tap to flip')).toBeInTheDocument();
    });

    it('should return null for empty cards', () => {
      const { container } = render(<FlashCard cards={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should not show navigation for single card', () => {
      render(<FlashCard cards={[{ front: 'Q', back: 'A' }]} />);

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });
  });

  describe('flipping', () => {
    it('should show back content after click', () => {
      render(<FlashCard cards={createCards()} />);

      const flipArea = screen.getByRole('button', { name: /what is react/i });
      fireEvent.click(flipArea);

      expect(screen.getByText('A JavaScript library for building UIs')).toBeInTheDocument();
    });

    it('should flip back on second click', () => {
      render(<FlashCard cards={createCards()} />);

      const flipArea = screen.getByRole('button', { name: /what is react/i });
      fireEvent.click(flipArea);
      fireEvent.click(flipArea);

      // Front should be visible again (transform back to 0)
      expect(screen.getByText('What is React?')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to next card', () => {
      render(<FlashCard cards={createCards()} />);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('What is JSX?')).toBeInTheDocument();
      expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
    });

    it('should navigate to previous card', () => {
      render(<FlashCard cards={createCards()} />);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /previous/i }));

      expect(screen.getByText('What is React?')).toBeInTheDocument();
    });

    it('should disable Previous on first card', () => {
      render(<FlashCard cards={createCards()} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('should disable Next on last card', () => {
      render(<FlashCard cards={createCards()} />);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('should reset flip state when navigating', () => {
      render(<FlashCard cards={createCards()} />);

      // Flip first card
      const flipArea = screen.getByRole('button', { name: /what is react/i });
      fireEvent.click(flipArea);

      // Navigate to next
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Next card should show front, not back
      expect(screen.getByText('What is JSX?')).toBeInTheDocument();
      expect(screen.getByText('Tap to flip')).toBeInTheDocument();
    });
  });

  describe('progress dots', () => {
    it('should render progress dots for multiple cards', () => {
      const { container } = render(<FlashCard cards={createCards()} />);

      const dots = container.querySelectorAll('[class*="rounded-full"][class*="w-2"]');
      expect(dots).toHaveLength(3);
    });
  });
});
