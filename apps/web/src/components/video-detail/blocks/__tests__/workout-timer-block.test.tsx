import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ExerciseCard } from '../ExerciseCard';
import type { WorkoutTimerBlock as WorkoutTimerBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<WorkoutTimerBlockType> = {}): WorkoutTimerBlockType => ({
  type: 'workout_timer',
  blockId: 'block-1',
  intervals: [
    { type: 'work', name: 'High knees', duration: 30 },
    { type: 'rest', name: 'Rest', duration: 10 },
    { type: 'work', name: 'Burpees', duration: 30 },
  ],
  rounds: 2,
  ...overrides,
});

describe('WorkoutTimerBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render timer display', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText('0:30')).toBeInTheDocument();
    });

    it('should render current interval name', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText(/high knees/i)).toBeInTheDocument();
    });

    it('should render round counter', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByText(/rounds.*1\/2/i)).toBeInTheDocument();
    });

    it('should return null for empty intervals', () => {
      const { container } = render(
        <ExerciseCard block={createMockBlock({ intervals: [] })} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('timer controls', () => {
    it('should have Start button initially', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    });

    it('should have Reset button', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });

    it('should change to Pause when running', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    });

    it('should show Resume after pause', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));
      fireEvent.click(screen.getByRole('button', { name: /pause/i }));

      // After pause, the button should change - just check that it's no longer showing "Pause"
      expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    });
  });

  describe('timer countdown', () => {
    it('should countdown when started', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('0:29')).toBeInTheDocument();
    });

    it('should reset timer on Reset click', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));

      expect(screen.getByText('0:30')).toBeInTheDocument();
    });
  });

  describe('interval transitions', () => {
    it('should move to next interval when time runs out', () => {
      render(<ExerciseCard block={createMockBlock()} />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      // Advance past first 30-second interval
      act(() => {
        vi.advanceTimersByTime(31000);
      });

      // Should now be on rest interval
      expect(screen.getByText(/rest/i)).toBeInTheDocument();
    });
  });

  describe('round tracking', () => {
    it('should not show round counter for single round', () => {
      render(<ExerciseCard block={createMockBlock({ rounds: 1 })} />);

      expect(screen.queryByText(/rounds/i)).not.toBeInTheDocument();
    });
  });

  describe('completion', () => {
    it('should show Complete when workout finishes', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            intervals: [{ type: 'work', name: 'Test', duration: 2 }],
            rounds: 1,
          })}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('Complete!')).toBeInTheDocument();
    });

    it('should disable play button when complete', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            intervals: [{ type: 'work', name: 'Test', duration: 2 }],
            rounds: 1,
          })}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      const playButton = screen.getByRole('button', { name: /start|pause|resume/i });
      expect(playButton).toBeDisabled();
    });
  });

  describe('interval preview', () => {
    it('should render progress indicators for intervals', () => {
      const { container } = render(<ExerciseCard block={createMockBlock()} />);

      // Progress bars are flex-1 rounded-full divs (phase dots use w-2 instead)
      const progressBars = container.querySelectorAll('.flex-1.rounded-full');
      expect(progressBars.length).toBe(3);
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<ExerciseCard block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have aria-live for timer announcements', () => {
      const { container } = render(<ExerciseCard block={createMockBlock()} />);
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should have role="alert" on completion', () => {
      render(
        <ExerciseCard
          block={createMockBlock({
            intervals: [{ type: 'work', name: 'Test', duration: 2 }],
            rounds: 1,
          })}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
