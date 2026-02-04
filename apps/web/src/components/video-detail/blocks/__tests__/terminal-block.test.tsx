import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TerminalBlock } from '../TerminalBlock';
import type { TerminalBlock as TerminalBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<TerminalBlockType> = {}): TerminalBlockType => ({
  type: 'terminal',
  blockId: 'block-1',
  command: 'npm install express',
  ...overrides,
});

describe('TerminalBlock', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render command', () => {
      render(<TerminalBlock block={createMockBlock()} />);

      expect(screen.getByText('npm install express')).toBeInTheDocument();
    });

    it('should render $ prompt', () => {
      render(<TerminalBlock block={createMockBlock()} />);

      expect(screen.getByText('$')).toBeInTheDocument();
    });

    it('should render output when present', () => {
      render(
        <TerminalBlock
          block={createMockBlock({
            output: 'added 57 packages',
          })}
        />
      );

      expect(screen.getByText('added 57 packages')).toBeInTheDocument();
    });

    it('should return null for empty command', () => {
      const { container } = render(<TerminalBlock block={createMockBlock({ command: '' })} />);
      expect(container.firstChild).toBeNull();
    });

    it('should have terminal styling', () => {
      const { container } = render(<TerminalBlock block={createMockBlock()} />);

      // Terminal has dark background
      const terminalContainer = container.querySelector('.bg-zinc-900');
      expect(terminalContainer).toBeInTheDocument();
    });
  });

  describe('terminal decoration', () => {
    it('should render traffic light buttons', () => {
      const { container } = render(<TerminalBlock block={createMockBlock()} />);

      expect(container.querySelector('.bg-red-500\\/80')).toBeInTheDocument();
      expect(container.querySelector('.bg-yellow-500\\/80')).toBeInTheDocument();
      expect(container.querySelector('.bg-green-500\\/80')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('should copy command to clipboard on click', async () => {
      render(<TerminalBlock block={createMockBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm install express');
    });

    it('should only copy command, not output', async () => {
      render(
        <TerminalBlock
          block={createMockBlock({
            output: 'added 57 packages',
          })}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm install express');
    });

    it('should show copied state after click', async () => {
      vi.useFakeTimers();
      render(<TerminalBlock block={createMockBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      // Check icon changed (aria-label changes to "Copied")
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('accessibility', () => {
    it('should have accessible copy button', () => {
      render(<TerminalBlock block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    });

    it('should use monospace font', () => {
      const { container } = render(<TerminalBlock block={createMockBlock()} />);

      const fontMono = container.querySelector('.font-mono');
      expect(fontMono).toBeInTheDocument();
    });
  });
});
