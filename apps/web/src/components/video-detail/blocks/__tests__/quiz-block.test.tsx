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
    it('should render all questions', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
      expect(screen.getByText('Which planet is closest to the Sun?')).toBeInTheDocument();
    });

    it('should render question numbers', () => {
      render(<QuizBlock block={createMockBlock()} />);

      expect(screen.getByText('Question 1')).toBeInTheDocument();
      expect(screen.getByText('Question 2')).toBeInTheDocument();
    });

    it('should render all options', () => {
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

      // Select correct answer (Paris, index 1)
      fireEvent.click(screen.getByRole('button', { name: /paris/i }));

      // Check for success semantic styling
      const correctButton = container.querySelector('.bg-success-soft');
      expect(correctButton).toBeInTheDocument();
    });

    it('should show incorrect answer styling for wrong selection', () => {
      const { container } = render(<QuizBlock block={createMockBlock()} />);

      // Select wrong answer (London, index 0)
      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      // Check for destructive semantic styling
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
  });

  describe('show/hide answer button', () => {
    it('should show "Show answer" buttons for each question when no selection', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // There are 2 questions, so 2 show answer buttons
      const buttons = screen.getAllByRole('button', { name: /show answer/i });
      expect(buttons.length).toBe(2);
    });

    it('should reveal answer when clicked', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // Click the first question's show answer button
      const buttons = screen.getAllByRole('button', { name: /show answer/i });
      fireEvent.click(buttons[0]);

      expect(screen.getByText(/paris is the capital/i)).toBeInTheDocument();
    });

    it('should change to "Hide answer" after reveal', () => {
      render(<QuizBlock block={createMockBlock()} />);

      const buttons = screen.getAllByRole('button', { name: /show answer/i });
      fireEvent.click(buttons[0]);

      expect(screen.getByRole('button', { name: /hide answer/i })).toBeInTheDocument();
    });

    it('should hide answer when "Hide answer" clicked', () => {
      render(<QuizBlock block={createMockBlock()} />);

      const buttons = screen.getAllByRole('button', { name: /show answer/i });
      fireEvent.click(buttons[0]);
      fireEvent.click(screen.getByRole('button', { name: /hide answer/i }));

      expect(screen.queryByText(/paris is the capital/i)).not.toBeInTheDocument();
    });

    it('should hide button for that question after selection', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // Before selection, 2 show answer buttons
      expect(screen.getAllByRole('button', { name: /show answer/i }).length).toBe(2);

      fireEvent.click(screen.getByRole('button', { name: /paris/i }));

      // After selection, only 1 show answer button (for question 2)
      expect(screen.getAllByRole('button', { name: /show answer/i }).length).toBe(1);
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

      // Click first option
      fireEvent.click(screen.getByRole('button', { name: /option a/i }));

      // Explanation label should not appear
      expect(screen.queryByText(/^explanation$/i)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      render(<QuizBlock block={createMockBlock()} />);

      // Reveal an answer to show check/x icons
      fireEvent.click(screen.getByRole('button', { name: /london/i }));

      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have focus-visible styling on options', () => {
      render(<QuizBlock block={createMockBlock()} />);

      const option = screen.getByRole('button', { name: /london/i });
      expect(option).toHaveClass('focus-visible:ring-2');
    });
  });
});
