import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { QuizInteractive } from '../QuizInteractive';

const questions = [
  {
    question: 'What is 2+2?',
    options: ['3', '4', '5', '6'],
    correctIndex: 1,
    explanation: 'Basic math.',
  },
  {
    question: 'Capital of France?',
    options: ['London', 'Paris', 'Berlin'],
    correctIndex: 1,
    explanation: 'Paris is the capital.',
  },
];

describe('QuizInteractive', () => {
  it('should render the first question', () => {
    render(<QuizInteractive questions={questions} />);
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.getByText('Q 1 of 2')).toBeInTheDocument();
  });

  it('renders an empty state for empty questions', () => {
    const { container } = render(<QuizInteractive questions={[]} />);
    expect(container.textContent).toContain('No quiz questions were generated');
  });

  it('should show explanation after selecting an answer', () => {
    render(<QuizInteractive questions={questions} />);
    // Click correct answer "4"
    fireEvent.click(screen.getByText('4'));
    expect(screen.getByText('Explanation')).toBeInTheDocument();
    expect(screen.getByText('Basic math.')).toBeInTheDocument();
  });

  it('should not allow re-answering after selection', () => {
    render(<QuizInteractive questions={questions} />);
    fireEvent.click(screen.getByText('4'));
    // Try clicking a different answer
    fireEvent.click(screen.getByText('3'));
    // Explanation should still show original answer
    expect(screen.getByText('Basic math.')).toBeInTheDocument();
  });

  it('should show navigation for multiple questions', () => {
    render(<QuizInteractive questions={questions} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should navigate to next question', () => {
    render(<QuizInteractive questions={questions} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Q 2 of 2')).toBeInTheDocument();
  });

  it('should not throw on unmount after wrong answer shake', () => {
    const { unmount } = render(<QuizInteractive questions={questions} />);
    // Click wrong answer to trigger shake timer
    fireEvent.click(screen.getByText('3'));
    // Immediately unmount — should not cause setState on unmounted component
    expect(() => unmount()).not.toThrow();
  });
});
