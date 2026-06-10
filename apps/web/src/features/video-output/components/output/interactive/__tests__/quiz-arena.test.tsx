import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { QuizArena, type QuizArenaQuestion } from '../QuizArena';

const questions: QuizArenaQuestion[] = [
  {
    question: 'What is 2+2?',
    options: ['3', '4', '5'],
    correctIndex: 1,
    explanation: 'Simple math.',
  },
  {
    question: 'Capital of France?',
    options: ['London', 'Paris', 'Berlin'],
    correctIndex: 1,
    explanation: 'It is Paris.',
  },
  {
    question: 'Largest planet?',
    options: ['Earth', 'Mars', 'Jupiter'],
    correctIndex: 2,
    explanation: 'Jupiter is largest.',
  },
];

const scenarioQuestion: QuizArenaQuestion = {
  question: 'What do you do?',
  options: ['Run', 'Hide', 'Help'],
  correctIndex: 2,
  context: 'A customer is asking for support during the keynote demo.',
  kind: 'scenario',
  explanation: 'Always help.',
};

describe('QuizArena', () => {
  it('should render the first question', () => {
    render(<QuizArena questions={questions} withTimer={false} />);
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.getByText('Q 1 of 3')).toBeInTheDocument();
  });

  it('renders an empty state for empty questions', () => {
    const { container } = render(<QuizArena questions={[]} />);
    expect(container.textContent).toContain('No quiz questions were generated');
  });

  it('should show explanation after selecting correct answer', () => {
    render(<QuizArena questions={questions} withTimer={false} />);
    fireEvent.click(screen.getByText('4'));
    expect(screen.getByText('Explanation')).toBeInTheDocument();
    expect(screen.getByText('Simple math.')).toBeInTheDocument();
  });

  it('should show explanation after selecting a wrong answer', () => {
    render(<QuizArena questions={questions} withTimer={false} />);
    fireEvent.click(screen.getByText('3'));
    expect(screen.getByText('Simple math.')).toBeInTheDocument();
  });

  it('should increment streak counter on consecutive correct answers', () => {
    render(<QuizArena questions={questions} withTimer={false} />);
    // Answer Q1 correctly
    fireEvent.click(screen.getByText('4'));
    // No streak badge yet (streak >= 2 threshold)
    expect(screen.queryByText(/streak!/)).toBeNull();
    // Move to Q2
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Paris'));
    // Streak should now show "2 streak!"
    expect(screen.getByText(/2 streak!/)).toBeInTheDocument();
  });

  it('should persist best score to localStorage when videoId is provided', () => {
    render(<QuizArena questions={questions} withTimer={false} videoId="abc-123" />);
    // Answer all 3 correctly
    fireEvent.click(screen.getByText('4'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Paris'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Jupiter'));
    expect(window.localStorage.getItem('vie:quiz:abc-123')).toBe('3');
  });

  it('should NOT persist best score when videoId is omitted', () => {
    render(<QuizArena questions={questions.slice(0, 1)} withTimer={false} />);
    fireEvent.click(screen.getByText('4'));
    // No videoId → no key stored.
    expect(window.localStorage.getItem('vie:quiz:undefined')).toBeNull();
  });

  it('should restart the quiz when Try Again is clicked', () => {
    render(<QuizArena questions={questions.slice(0, 1)} withTimer={false} />);
    fireEvent.click(screen.getByText('4'));
    // Single-question quiz reaches completion immediately
    const tryAgain = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgain);
    // After reset, the explanation is no longer in the DOM.
    expect(screen.queryByText('Explanation')).toBeNull();
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });

  it('should render the scenario context blockquote when provided', () => {
    render(<QuizArena questions={[scenarioQuestion]} withTimer={false} />);
    expect(
      screen.getByText('A customer is asking for support during the keynote demo.'),
    ).toBeInTheDocument();
  });

  it('should render the timer ring by default', () => {
    const { container } = render(<QuizArena questions={questions} />);
    expect(container.querySelector('[data-slot="countdown-ring"]')).not.toBeNull();
  });

  it('should not render the timer ring when withTimer=false', () => {
    const { container } = render(<QuizArena questions={questions} withTimer={false} />);
    expect(container.querySelector('[data-slot="countdown-ring"]')).toBeNull();
  });
});
