import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizBlock } from '../QuizBlock';
import type { QuizBlock as QuizBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<QuizBlockType> = {}): QuizBlockType => ({
  type: 'quiz',
  blockId: 'block-1',
  questions: [
    {
      question: 'What is the capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctIndex: 1,
      explanation: 'Paris is the capital and largest city of France.',
    },
    {
      question: 'Which planet is closest to the Sun?',
      options: ['Venus', 'Mercury', 'Mars'],
      correctIndex: 1,
    },
  ],
  ...overrides,
});

describe('QuizBlock', () => {
  describe('rendering', () => {
    it('should render the first question only', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
      // Second question should NOT be visible (one at a time)
      expect(screen.queryByText('Which planet is closest to the Sun?')).not.toBeInTheDocument();
    });

    it('should show progress indicator for multiple questions', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();
    });

    it('should not show progress for single question', () => {
      render(<QuizBlock block={createMockBlock({
        questions: [{ question: 'Only one?', options: ['Yes', 'No'], correctIndex: 0 }],
      })} />);

      expect(screen.queryByText(/of/)).not.toBeInTheDocument();
    });

    it('should render all options for the active question', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getByText('London')).toBeInTheDocument();
      expect(screen.getByText('Paris')).toBeInTheDocument();
      expect(screen.getByText('Berlin')).toBeInTheDocument();
      expect(screen.getByText('Madrid')).toBeInTheDocument();
    });

    it('should render option letters (A, B, C, D)', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getAllByText('A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('B').length).toBeGreaterThan(0);
      expect(screen.getAllByText('C').length).toBeGreaterThan(0);
    });

    it('should return null for empty questions', () => {
      const { container } = render(<QuizBlock block={createMockBlock({ questions: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('navigation', () => {
    it('should navigate to next question', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Which planet is closest to the Sun?')).toBeInTheDocument();
      expect(screen.queryByText('What is the capital of France?')).not.toBeInTheDocument();
      expect(screen.getByText(/Question 2 of 2/)).toBeInTheDocument();
    });

    it('should navigate back to previous question', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // Go to question 2
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      // Go back to question 1
      fireEvent.click(screen.getByRole('button', { name: /previous/i }));

      expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    });

    it('should disable Previous on first question', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('should disable Next on last question', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('should not show navigation for single question', () => {
      render(<QuizBlock block={createMockBlock({
        questions: [{ question: 'Only one?', options: ['Yes', 'No'], correctIndex: 0 }],
      })} />);

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    });
  });

  describe('answer selection', () => {
    it('should select answer when clicked', () => {
      render(<QuizBlock block={createMockBlock()} />);

      const parisOption = screen.getByRole('button', { name: /paris/i });
      fireEvent.click(parisOption);

      // After selection, answer is revealed
      expect(parisOption).toBeDisabled();
    });

    it('should auto-reveal answer after selection', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      // Explanation should be shown
      expect(screen.getByText(/paris is the capital/i)).toBeInTheDocument();
    });

    it('should show correct answer styling for correct selection', () => {
      const { container } = render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /paris/i }));

      const correctButton = container.querySelector('.bg-success-soft');
      expect(correctButton).toBeInTheDocument();
    });

    it('should show incorrect answer styling for wrong selection', () => {
      const { container } = render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      const wrongButton = container.querySelector('.bg-destructive\\/10');
      expect(wrongButton).toBeInTheDocument();
    });

    it('should disable all options after selection', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      const options = screen.getAllByRole('button', { name: /london|paris|berlin|madrid/i });
      options.forEach(option => {
        expect(option).toBeDisabled();
      });
    });

    it('should preserve answer state when navigating away and back', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // Answer question 1
      fireEvent.click(screen.getByRole('button', { name: /paris/i }));

      // Navigate away and back
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /previous/i }));

      // Answer should still be revealed
      expect(screen.getByText(/paris is the capital/i)).toBeInTheDocument();
    });
  });

  describe('show/hide answer button', () => {
    it('should show "Show answer" button when no selection', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // One show answer button for the active question
      expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    });

    it('should reveal answer when clicked', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

      expect(screen.getByText(/paris is the capital/i)).toBeInTheDocument();
    });

    it('should change to "Hide answer" after reveal', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

      expect(screen.getByRole('button', { name: /hide answer/i })).toBeInTheDocument();
    });

    it('should hide answer when "Hide answer" clicked', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
      fireEvent.click(screen.getByRole('button', { name: /hide answer/i }));

      expect(screen.queryByText(/paris is the capital/i)).not.toBeInTheDocument();
    });

    it('should hide button after selection', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /paris/i }));

      // Show answer button should be gone (answer is auto-revealed)
      expect(screen.queryByRole('button', { name: /show answer/i })).not.toBeInTheDocument();
    });
  });

  describe('explanation', () => {
    it('should display explanation after reveal', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      expect(screen.getByText(/explanation/i)).toBeInTheDocument();
      expect(screen.getByText('Paris is the capital and largest city of France.')).toBeInTheDocument();
    });

    it('should not show explanation section for questions without explanation', () => {
      render(
        <QuizBlock
          block={createMockBlock({
            questions: [
              {
                question: 'Simple question',
                options: ['Option A', 'Option B'],
                correctIndex: 0,
              },
            ],
          })}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /option a/i }));

      expect(screen.queryByText(/^explanation$/i)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      render(<QuizBlock block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should render options as button elements', () => {
      render(<QuizBlock block={createMockBlock()} />);

      const option = screen.getByRole('button', { name: /london/i });
      expect(option).toBeInstanceOf(HTMLButtonElement);
      expect(option).not.toBeDisabled();
    });
  });
});
