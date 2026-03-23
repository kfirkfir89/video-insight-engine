import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { ScenarioInteractive } from '../ScenarioInteractive';

const scenarios = [
  {
    question: 'A customer is angry. What do you do?',
    emoji: '😤',
    options: [
      { text: 'Listen actively', correct: true, explanation: 'Active listening shows empathy.' },
      { text: 'Argue back', correct: false, explanation: 'This escalates the situation.' },
    ],
  },
  {
    question: 'Server is down. What first?',
    options: [
      { text: 'Check logs', correct: true, explanation: 'Logs reveal the cause.' },
      { text: 'Reboot', correct: false, explanation: 'Might lose diagnostic info.' },
    ],
  },
];

describe('ScenarioInteractive', () => {
  it('should render the first scenario', () => {
    render(<ScenarioInteractive scenarios={scenarios} />);
    expect(screen.getByText('A customer is angry. What do you do?')).toBeInTheDocument();
    expect(screen.getByText('Scenario 1 of 2')).toBeInTheDocument();
  });

  it('should return null for empty scenarios', () => {
    const { container } = render(<ScenarioInteractive scenarios={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show option explanations after answering', () => {
    render(<ScenarioInteractive scenarios={scenarios} />);
    fireEvent.click(screen.getByText('Listen actively'));
    // Both explanations revealed
    expect(screen.getByText('Active listening shows empathy.')).toBeInTheDocument();
    expect(screen.getByText('This escalates the situation.')).toBeInTheDocument();
  });

  it('should show navigation for multiple scenarios', () => {
    render(<ScenarioInteractive scenarios={scenarios} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Server is down. What first?')).toBeInTheDocument();
  });
});
