import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock';
import type { CodeBlock as CodeBlockType, TerminalBlock as TerminalBlockType } from '@vie/types';

const createCodeBlock = (overrides: Partial<CodeBlockType> = {}): CodeBlockType => ({
  type: 'code',
  blockId: 'block-1',
  code: 'const greeting = "Hello, World!";\nconsole.log(greeting);',
  language: 'javascript',
  ...overrides,
});

const createTerminalBlock = (overrides: Partial<TerminalBlockType> = {}): TerminalBlockType => ({
  type: 'terminal',
  blockId: 'block-2',
  command: 'npm install express',
  ...overrides,
});

describe('CodeBlock (unified)', () => {
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

  describe('code type', () => {
    it('should render code content', () => {
      render(<CodeBlock block={createCodeBlock()} />);

      expect(screen.getByText(/const greeting/)).toBeInTheDocument();
      expect(screen.getByText(/console\.log/)).toBeInTheDocument();
    });

    it('should return null for empty code', () => {
      const { container } = render(<CodeBlock block={createCodeBlock({ code: '' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('example type (props form)', () => {
    it('should render code from props', () => {
      render(<CodeBlock code="const x = 1;" />);

      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('should render explanation when provided', () => {
      render(<CodeBlock code="const x = 1;" explanation="Simple variable declaration" />);

      expect(screen.getByText('Simple variable declaration')).toBeInTheDocument();
    });

    it('should return null for empty code', () => {
      const { container } = render(<CodeBlock code="" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('terminal type', () => {
    it('should render command', () => {
      render(<CodeBlock block={createTerminalBlock()} />);

      expect(screen.getByText(/npm install express/)).toBeInTheDocument();
    });

    it('should render output when present', () => {
      render(<CodeBlock block={createTerminalBlock({ output: 'added 57 packages' })} />);

      expect(screen.getByText(/added 57 packages/)).toBeInTheDocument();
    });

    it('should return null for empty command', () => {
      const { container } = render(<CodeBlock block={createTerminalBlock({ command: '' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('copy functionality', () => {
    it('should copy code to clipboard on click', async () => {
      render(<CodeBlock block={createCodeBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'const greeting = "Hello, World!";\nconsole.log(greeting);'
      );
    });

    it('should only copy command for terminal (not output)', async () => {
      render(<CodeBlock block={createTerminalBlock({ output: 'added 57 packages' })} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm install express');
    });

    it('should show copied state after click', async () => {
      vi.useFakeTimers();
      render(<CodeBlock block={createCodeBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should reset copied state after timeout', async () => {
      vi.useFakeTimers();
      render(<CodeBlock block={createCodeBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('accessibility', () => {
    it('should have accessible copy button', () => {
      render(<CodeBlock block={createCodeBlock()} />);

      expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<CodeBlock block={createCodeBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should use pre and code elements for semantic markup', () => {
      const { container } = render(<CodeBlock block={createCodeBlock()} />);
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(container.querySelector('code')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have dark background', () => {
      const { container } = render(<CodeBlock block={createCodeBlock()} />);
      const codeDiv = container.querySelector('.rounded-lg');
      expect(codeDiv).toBeInTheDocument();
    });

    it('should have no header chrome', () => {
      const { container } = render(<CodeBlock block={createCodeBlock()} />);
      expect(container.querySelector('.block-code-header')).not.toBeInTheDocument();
    });
  });
});
