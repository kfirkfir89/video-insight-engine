import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseCard } from '../ExerciseCard';
import type { ExerciseBlock as ExerciseBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<ExerciseBlockType> = {}): ExerciseBlockType => ({
  type: 'exercise',
  blockId: 'block-1',
  exercises: [
    { name: 'Push-ups', sets: 3, reps: '10' },
    { name: 'Squats', sets: 4, reps: '12', difficulty: 'beginner' },
    { name: 'Plank', duration: '60s', difficulty: 'intermediate' },
  ],
  ...overrides,
});

describe('ExerciseBlock', () => {
  describe('rendering', () => {
    it('should render all exercises', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText('Push-ups')).toBeInTheDocument();
      expect(screen.getByText('Squats')).toBeInTheDocument();
      expect(screen.getByText('Plank')).toBeInTheDocument();
    });

    it('should render sets and reps', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      // Multiple exercises can have Sets/Reps labels
      expect(screen.getAllByText('Sets').length).toBeGreaterThan(0);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getAllByText('Reps').length).toBeGreaterThan(0);
    });

    it('should render duration', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText('60s')).toBeInTheDocument();
    });

    it('should return null for empty exercises', () => {
      const { container } = render(<ExerciseCard block={createMockBlock({ exercises: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('difficulty badges', () => {
    it('should render beginner difficulty', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText('Beginner')).toBeInTheDocument();
    });

    it('should render intermediate difficulty', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText('Intermediate')).toBeInTheDocument();
    });

    it('should render advanced difficulty', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Muscle-up', difficulty: 'advanced' }],
          })}
        />
      );

      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    it('should not render difficulty when not specified', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Simple exercise' }],
          })}
        />
      );

      expect(screen.queryByText('Beginner')).not.toBeInTheDocument();
      expect(screen.queryByText('Intermediate')).not.toBeInTheDocument();
      expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
    });
  });

  describe('rest periods', () => {
    it('should render rest period', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Burpees', rest: '30s' }],
          })}
        />
      );

      expect(screen.getByText(/rest.*30s/i)).toBeInTheDocument();
    });
  });

  describe('notes', () => {
    it('should render exercise notes', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Push-ups', notes: 'Keep your core tight' }],
          })}
        />
      );

      expect(screen.getByText('Keep your core tight')).toBeInTheDocument();
    });
  });

  describe('video timestamp integration', () => {
    it('should render "Watch demo" button when timestamp provided', () => {
      const onPlay = vi.fn();
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Deadlift', timestamp: 120 }],
          })}
          onPlay={onPlay}
        />
      );

      expect(screen.getByText('Watch demo')).toBeInTheDocument();
    });

    it('should call onPlay with timestamp when clicked', () => {
      const onPlay = vi.fn();
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Deadlift', timestamp: 120 }],
          })}
          onPlay={onPlay}
        />
      );

      fireEvent.click(screen.getByText('Watch demo'));
      expect(onPlay).toHaveBeenCalledWith(120);
    });

    it('should not render demo button when no onPlay provided', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            exercises: [{ name: 'Deadlift', timestamp: 120 }],
          })}
        />
      );

      expect(screen.queryByText('Watch demo')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<ExerciseCard block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
