import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { ExerciseInteractive } from '../ExerciseInteractive';

const exercises = [
  { name: 'Push-ups', emoji: '💪', sets: 3, reps: '10', difficulty: 'beginner' as const, formCues: ['Keep back straight'], modifications: [] },
  { name: 'Squats', emoji: '🦵', sets: 3, reps: '15', formCues: [], modifications: [] },
];

describe('ExerciseInteractive', () => {
  it('should render all exercises', () => {
    render(<ExerciseInteractive exercises={exercises} />);
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
  });

  it('should return null for empty exercises', () => {
    const { container } = render(<ExerciseInteractive exercises={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show sets and reps', () => {
    render(<ExerciseInteractive exercises={exercises} />);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should show difficulty badge', () => {
    render(<ExerciseInteractive exercises={exercises} />);
    expect(screen.getByText('beginner')).toBeInTheDocument();
  });

  it('should show hero card with meta', () => {
    render(
      <ExerciseInteractive
        exercises={exercises}
        meta={{ type: 'HIIT', difficulty: 'intermediate', duration: 30, equipment: ['Dumbbells'] }}
      />,
    );
    expect(screen.getByText('HIIT')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
  });

  it('should show progress counter', () => {
    render(<ExerciseInteractive exercises={exercises} />);
    expect(screen.getByText('0/6 sets')).toBeInTheDocument();
  });

  it('should show section nav with warmup/cooldown', () => {
    render(
      <ExerciseInteractive
        exercises={exercises}
        warmup={['Jumping jacks', 'Arm circles']}
        cooldown={['Stretching']}
      />,
    );
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
    expect(screen.getByText('Cool-down')).toBeInTheDocument();
  });
});
