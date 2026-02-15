import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock';
import type { CodeBlock as CodeBlockType } from '@vie/types';

// Mock syntax highlighting hook — tests verify CodeBlock behavior, not Shiki
vi.mock('@/hooks/use-syntax-highlight', () => ({
  useSyntaxHighlight: () => ({ html: null, isLoading: false }),
}));

const createMockBlock = (overrides: Partial<CodeBlockType> = {}): CodeBlockType => ({
  type: 'code',
  blockId: 'block-1',
  code: 'const greeting = "Hello, World!";\nconsole.log(greeting);',
  language: 'javascript',
  ...overrides,
});

describe('CodeBlock', () => {
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
    it('should render code content', () => {
      render(<CodeBlock block={createMockBlock()} />);

      expect(screen.getByText('const greeting = "Hello, World!";')).toBeInTheDocument();
      expect(screen.getByText('console.log(greeting);')).toBeInTheDocument();
    });

    it('should display language when no filename', () => {
      render(<CodeBlock block={createMockBlock()} />);

      // Language is rendered as uppercase
      expect(screen.getByText(/javascript/i)).toBeInTheDocument();
    });

    it('should display filename when present', () => {
      render(<CodeBlock block={createMockBlock({ filename: 'app.js' })} />);

      expect(screen.getByText('app.js')).toBeInTheDocument();
    });

    it('should prefer filename over language display', () => {
      render(<CodeBlock block={createMockBlock({ filename: 'app.js' })} />);

      expect(screen.getByText('app.js')).toBeInTheDocument();
      expect(screen.queryByText('JAVASCRIPT')).not.toBeInTheDocument();
    });

    it('should return null for empty code', () => {
      const { container } = render(<CodeBlock block={createMockBlock({ code: '' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('line numbers', () => {
    it('should show line numbers for multi-line code', () => {
      render(<CodeBlock block={createMockBlock()} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should not show line numbers for single-line code', () => {
      render(<CodeBlock block={createMockBlock({ code: 'const x = 1;' })} />);

      // Single line code doesn't use table-based rendering
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('line highlighting', () => {
    it('should highlight specified lines', () => {
      const { container } = render(
        <CodeBlock block={createMockBlock({ highlightLines: [1] })} />
      );

      const rows = container.querySelectorAll('tr');
      expect(rows[0]).toHaveClass('bg-primary/10');
      expect(rows[1]).not.toHaveClass('bg-primary/10');
    });
  });

  describe('copy functionality', () => {
    it('should copy code to clipboard on click', async () => {
      render(<CodeBlock block={createMockBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'const greeting = "Hello, World!";\nconsole.log(greeting);'
      );
    });

    it('should show copied state after click', async () => {
      vi.useFakeTimers();
      render(<CodeBlock block={createMockBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(screen.getByText('Copied!')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should reset copied state after timeout', async () => {
      vi.useFakeTimers();
      render(<CodeBlock block={createMockBlock()} />);

      const copyButton = screen.getByRole('button', { name: /copy code/i });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(screen.getByText('Copied!')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('Copy code')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('accessibility', () => {
    it('should have accessible copy button', () => {
      render(<CodeBlock block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<CodeBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should use pre element for code', () => {
      const { container } = render(<CodeBlock block={createMockBlock()} />);
      expect(container.querySelector('pre')).toBeInTheDocument();
    });

    it('should use code element for semantic markup', () => {
      const { container } = render(<CodeBlock block={createMockBlock()} />);
      expect(container.querySelector('code')).toBeInTheDocument();
    });
  });
});
