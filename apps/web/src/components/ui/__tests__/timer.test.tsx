import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Timer, useTimer } from '../timer';
import { renderHook } from '@testing-library/react';

describe('Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Timer />);
      expect(screen.getByRole('timer')).toBeInTheDocument();
      expect(screen.getByText('0:00')).toBeInTheDocument();
    });

    it('should render with initial seconds', () => {
      render(<Timer initialSeconds={125} />);
      expect(screen.getByText('2:05')).toBeInTheDocument();
    });

    it('should format hours correctly', () => {
      render(<Timer initialSeconds={3665} />);
      expect(screen.getByText('1:01:05')).toBeInTheDocument();
    });

    it('should render controls by default', () => {
      render(<Timer initialSeconds={60} />);
      expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset timer/i })).toBeInTheDocument();
    });

    it('should hide controls when showControls is false', () => {
      render(<Timer showControls={false} />);
      expect(screen.queryByRole('button', { name: /start timer/i })).not.toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('should apply small size class', () => {
      render(<Timer size="sm" />);
      const timer = screen.getByRole('timer');
      expect(timer.querySelector('.text-lg')).toBeInTheDocument();
    });

    it('should apply medium size class', () => {
      render(<Timer size="md" />);
      const timer = screen.getByRole('timer');
      expect(timer.querySelector('.text-2xl')).toBeInTheDocument();
    });

    it('should apply large size class', () => {
      render(<Timer size="lg" />);
      const timer = screen.getByRole('timer');
      expect(timer.querySelector('.text-4xl')).toBeInTheDocument();
    });
  });

  describe('countdown mode', () => {
    it('should countdown when started', () => {
      render(<Timer initialSeconds={5} mode="countdown" />);

      const startButton = screen.getByRole('button', { name: /start timer/i });
      fireEvent.click(startButton);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('0:04')).toBeInTheDocument();
    });

    it('should stop at zero and call onComplete', () => {
      const onComplete = vi.fn();
      render(<Timer initialSeconds={2} mode="countdown" onComplete={onComplete} />);

      fireEvent.click(screen.getByRole('button', { name: /start timer/i }));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it('should disable start button when countdown is at zero', () => {
      render(<Timer initialSeconds={0} mode="countdown" />);
      expect(screen.getByRole('button', { name: /start timer/i })).toBeDisabled();
    });
  });

  describe('countup mode', () => {
    it('should count up when started', () => {
      render(<Timer initialSeconds={0} mode="countup" />);

      fireEvent.click(screen.getByRole('button', { name: /start timer/i }));

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('0:03')).toBeInTheDocument();
    });

    it('should call onTick callback', () => {
      const onTick = vi.fn();
      render(<Timer initialSeconds={0} mode="countup" onTick={onTick} />);

      fireEvent.click(screen.getByRole('button', { name: /start timer/i }));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(onTick).toHaveBeenCalledTimes(2);
      expect(onTick).toHaveBeenLastCalledWith(2);
    });
  });

  describe('controls', () => {
    it('should pause when pause button is clicked', () => {
      render(<Timer initialSeconds={10} mode="countdown" autoStart />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('0:08')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should still be 8 seconds (paused)
      expect(screen.getByText('0:08')).toBeInTheDocument();
    });

    it('should reset to initial value when reset is clicked', () => {
      render(<Timer initialSeconds={60} mode="countdown" />);

      fireEvent.click(screen.getByRole('button', { name: /start timer/i }));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('0:55')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /reset timer/i }));

      expect(screen.getByText('1:00')).toBeInTheDocument();
    });
  });

  describe('autoStart', () => {
    it('should start automatically when autoStart is true', () => {
      render(<Timer initialSeconds={10} mode="countdown" autoStart />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('0:09')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible timer role', () => {
      render(<Timer initialSeconds={60} />);
      const timer = screen.getByRole('timer');
      expect(timer).toHaveAttribute('aria-label', 'Timer: 1:00');
    });

    it('should have accessible button labels', () => {
      render(<Timer initialSeconds={60} />);
      expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset timer/i })).toBeInTheDocument();
    });
  });
});

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useTimer(60, 'countdown'));

    expect(result.current.seconds).toBe(60);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.formatted).toBe('1:00');
  });

  it('should start and update seconds', () => {
    const { result } = renderHook(() => useTimer(60, 'countdown'));

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.seconds).toBe(58);
    expect(result.current.formatted).toBe('0:58');
  });

  it('should pause timer', () => {
    const { result } = renderHook(() => useTimer(60, 'countdown'));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const secondsBeforePause = result.current.seconds;

    act(() => {
      result.current.pause();
    });

    expect(result.current.isRunning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should still be same as before pause
    expect(result.current.seconds).toBe(secondsBeforePause);
  });

  it('should reset timer', () => {
    const { result } = renderHook(() => useTimer(60, 'countdown'));

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(5000);
      result.current.reset();
    });

    expect(result.current.seconds).toBe(60);
    expect(result.current.isRunning).toBe(false);
  });

  it('should count up in countup mode', () => {
    const { result } = renderHook(() => useTimer(0, 'countup'));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBeGreaterThan(0);
  });
});
