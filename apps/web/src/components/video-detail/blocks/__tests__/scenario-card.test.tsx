import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioCard } from '../ScenarioCard';

const createScenarios = () => [
  {
    question: 'Which framework is best for SSR?',
    emoji: '\u{1F914}',
    options: [
      { text: 'jQuery', correct: false, explanation: 'jQuery is not a framework for SSR.' },
      { text: 'Next.js', correct: true, explanation: 'Next.js has built-in SSR support.' },
      { text: 'Lodash', correct: false, explanation: 'Lodash is a utility library.' },
    ],
  },
  {
    question: 'Which database is NoSQL?',
    options: [
      { text: 'PostgreSQL', correct: false, explanation: 'PostgreSQL is relational.' },
      { text: 'MongoDB', correct: true, explanation: 'MongoDB is a NoSQL database.' },
    ],
  },
];

describe('ScenarioCard', () => {
  describe('rendering', () => {
    it('should render the first scenario question', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      expect(screen.getByText('Which framework is best for SSR?')).toBeInTheDocument();
    });

    it('should render emoji when provided', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      expect(screen.getByText('\u{1F914}')).toBeInTheDocument();
    });

    it('should render all options for active scenario', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      expect(screen.getByText('jQuery')).toBeInTheDocument();
      expect(screen.getByText('Next.js')).toBeInTheDocument();
      expect(screen.getByText('Lodash')).toBeInTheDocument();
    });

    it('should render progress indicator', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      expect(screen.getByText(/Scenario 1 of 2/)).toBeInTheDocument();
    });

    it('should return null for empty scenarios', () => {
      const { container } = render(<ScenarioCard scenarios={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('answer selection', () => {
    it('should show explanation after selecting an option', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      fireEvent.click(screen.getByRole('button', { name: /next\.js/i }));

      expect(screen.getByText('Next.js has built-in SSR support.')).toBeInTheDocument();
    });

    it('should disable all options after selection', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      fireEvent.click(screen.getByRole('button', { name: /next\.js/i }));

      const options = screen.getAllByRole('button', { name: /jquery|next\.js|lodash/i });
      options.forEach(option => {
        expect(option).toBeDisabled();
      });
    });

    it('should highlight correct option with success styling', () => {
      const { container } = render(<ScenarioCard scenarios={createScenarios()} />);

      fireEvent.click(screen.getByRole('button', { name: /jquery/i }));

      const correctButton = container.querySelector('.bg-success-soft');
      expect(correctButton).toBeInTheDocument();
    });

    it('should highlight wrong selection with destructive styling', () => {
      const { container } = render(<ScenarioCard scenarios={createScenarios()} />);

      fireEvent.click(screen.getByRole('button', { name: /jquery/i }));

      const wrongButton = container.querySelector('.bg-destructive\\/10');
      expect(wrongButton).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to next scenario', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

      expect(screen.getByText('Which database is NoSQL?')).toBeInTheDocument();
    });

    it('should disable Previous on first scenario', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('should disable Next on last scenario', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

      expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
    });
  });

  describe('score tracking', () => {
    it('should show score summary when all scenarios answered', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      // Answer first scenario correctly
      fireEvent.click(screen.getByRole('button', { name: /next\.js/i }));

      // Go to second scenario
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

      // Answer second scenario correctly
      fireEvent.click(screen.getByRole('button', { name: /mongodb/i }));

      expect(screen.getByText(/Your Score: 2\/2/)).toBeInTheDocument();
      expect(screen.getByText('Perfect score!')).toBeInTheDocument();
    });

    it('should show appropriate message for partial score', () => {
      render(<ScenarioCard scenarios={createScenarios()} />);

      // Answer first scenario wrong
      fireEvent.click(screen.getByRole('button', { name: /jquery/i }));

      // Go to second and answer correctly — use exact match to avoid hitting "Next.js"
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
      fireEvent.click(screen.getByRole('button', { name: /mongodb/i }));

      expect(screen.getByText(/Your Score: 1\/2/)).toBeInTheDocument();
      expect(screen.getByText('Good job!')).toBeInTheDocument();
    });
  });
});
