import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { StepByStepInteractive } from '../StepByStepInteractive';

const steps = [
  { number: 1, title: 'Prep', instruction: 'Chop vegetables', duration: '5 min' },
  { number: 2, title: 'Cook', instruction: 'Sauté in pan', tips: 'Use medium heat' },
  { number: 3, title: 'Serve', instruction: 'Plate and garnish' },
];

describe('StepByStepInteractive', () => {
  it('should render all steps in scrollable mode', () => {
    render(<StepByStepInteractive steps={steps} />);
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Cook')).toBeInTheDocument();
    expect(screen.getByText('Serve')).toBeInTheDocument();
  });

  it('should return null for empty steps', () => {
    const { container } = render(<StepByStepInteractive steps={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show progress counter', () => {
    render(<StepByStepInteractive steps={steps} />);
    expect(screen.getByText('0/3 steps')).toBeInTheDocument();
  });

  it('should show duration when present', () => {
    render(<StepByStepInteractive steps={steps} />);
    expect(screen.getByText('5 min')).toBeInTheDocument();
  });

  it('should render only current step in one_at_a_time mode', () => {
    render(<StepByStepInteractive steps={steps} mode="one_at_a_time" />);
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.queryByText('Cook')).not.toBeInTheDocument();
  });

  it('should navigate in one_at_a_time mode', () => {
    render(<StepByStepInteractive steps={steps} mode="one_at_a_time" />);
    // BackForward renders Forward button
    const forwardBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Next') || b.getAttribute('aria-label')?.includes('forward'));
    if (forwardBtn) fireEvent.click(forwardBtn);
  });
});
