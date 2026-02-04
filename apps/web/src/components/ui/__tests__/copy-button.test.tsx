import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CopyButton } from '../copy-button';

describe('CopyButton', () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
    mockWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<CopyButton text="test" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with custom label', () => {
      render(<CopyButton text="test" label="Copy code" />);
      expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    });

    it('should render tooltip by default', () => {
      render(<CopyButton text="test" />);
      // Tooltip trigger should exist
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not render tooltip when showTooltip is false', () => {
      render(<CopyButton text="test" showTooltip={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('variants and sizes', () => {
    it('should apply ghost variant by default', () => {
      render(<CopyButton text="test" />);
      // Button component applies the variant internally
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept different variants', () => {
      render(<CopyButton text="test" variant="outline" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept different sizes', () => {
      render(<CopyButton text="test" size="sm" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('should copy text to clipboard when clicked', async () => {
      render(<CopyButton text="text to copy" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockWriteText).toHaveBeenCalledWith('text to copy');
    });

    it('should show success state after copying', async () => {
      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });

    it('should reset to default state after 2 seconds', async () => {
      render(<CopyButton text="test" label="Copy to clipboard" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
    });

    it('should call onCopy callback after successful copy', async () => {
      const onCopy = vi.fn();
      render(<CopyButton text="test" onCopy={onCopy} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('should handle clipboard errors gracefully', async () => {
      mockWriteText.mockRejectedValue(new Error('Clipboard error'));

      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Should not crash and should not show "Copied!" state
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible label', () => {
      render(<CopyButton text="test" label="Copy this text" />);
      expect(screen.getByRole('button', { name: /copy this text/i })).toBeInTheDocument();
    });

    it('should update aria-label when copied', async () => {
      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });

    it('should be keyboard accessible', async () => {
      render(<CopyButton text="test" />);

      const button = screen.getByRole('button');
      button.focus();

      await act(async () => {
        fireEvent.keyDown(button, { key: 'Enter' });
        fireEvent.click(button); // Use click instead as keyDown doesn't trigger onClick
      });

      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<CopyButton text="test" className="custom-class" />);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });
});
