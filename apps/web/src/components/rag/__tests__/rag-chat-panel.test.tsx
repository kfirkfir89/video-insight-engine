import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the deleted ContentBlocks component that RAGChatPanel imports
vi.mock('@/components/video-detail/ContentBlocks', () => ({
  ContentBlocks: ({ blocks }: { blocks: unknown[] }) => (
    <div data-testid="content-blocks">{Array.isArray(blocks) ? blocks.length : 0} blocks</div>
  ),
}));

import { RAGChatPanel } from '../RAGChatPanel';

// Mock scrollIntoView as jsdom doesn't support it
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const createMessage = (overrides = {}) => ({
  id: 'msg-1',
  role: 'user' as const,
  content: 'Hello',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('RAGChatPanel', () => {
  const defaultProps = {
    messages: [],
    onSendMessage: vi.fn(),
  };

  describe('rendering', () => {
    it('should render header', () => {
      render(<RAGChatPanel {...defaultProps} />);

      expect(screen.getByText('Chat with your knowledge')).toBeInTheDocument();
    });

    it('should render empty state when no messages', () => {
      render(<RAGChatPanel {...defaultProps} />);

      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.getByText(/ask questions about your memorized/i)).toBeInTheDocument();
    });

    it('should render messages when provided', () => {
      render(
        <RAGChatPanel
          {...defaultProps}
          messages={[
            createMessage({ id: 'msg-1', role: 'user', content: 'What is React?' }),
            createMessage({ id: 'msg-2', role: 'assistant', content: 'React is a UI library.' }),
          ]}
        />
      );

      expect(screen.getByText('What is React?')).toBeInTheDocument();
      expect(screen.getByText('React is a UI library.')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <RAGChatPanel {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('message bubbles', () => {
    it('should style user messages differently from assistant', () => {
      const { container } = render(
        <RAGChatPanel
          {...defaultProps}
          messages={[
            createMessage({ role: 'user', content: 'User message' }),
            createMessage({ id: 'msg-2', role: 'assistant', content: 'Assistant message' }),
          ]}
        />
      );

      // User bubble should have primary color
      const userBubble = container.querySelector('.bg-primary.text-primary-foreground');
      expect(userBubble).toBeInTheDocument();
    });

    it('should show streaming cursor when isStreaming', () => {
      render(
        <RAGChatPanel
          {...defaultProps}
          messages={[
            createMessage({
              role: 'assistant',
              content: 'Thinking...',
              isStreaming: true,
            }),
          ]}
        />
      );

      expect(screen.getByText('▌')).toBeInTheDocument();
    });
  });

  describe('input handling', () => {
    it('should render input field', () => {
      render(<RAGChatPanel {...defaultProps} />);

      expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    });

    it('should use custom placeholder when provided', () => {
      render(<RAGChatPanel {...defaultProps} placeholder="Custom placeholder..." />);

      expect(screen.getByPlaceholderText('Custom placeholder...')).toBeInTheDocument();
    });

    it('should call onSendMessage when form submitted', () => {
      const onSendMessage = vi.fn();
      render(<RAGChatPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/ask a question/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after submit', () => {
      const onSendMessage = vi.fn();
      render(<RAGChatPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/ask a question/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);

      expect(input.value).toBe('');
    });

    it('should trim whitespace from message', () => {
      const onSendMessage = vi.fn();
      render(<RAGChatPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/ask a question/i);
      fireEvent.change(input, { target: { value: '  Test message  ' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should not submit empty messages', () => {
      const onSendMessage = vi.fn();
      render(<RAGChatPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/ask a question/i);
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable input when loading', () => {
      render(<RAGChatPanel {...defaultProps} isLoading />);

      expect(screen.getByPlaceholderText(/ask a question/i)).toBeDisabled();
    });

    it('should disable submit button when loading', () => {
      render(<RAGChatPanel {...defaultProps} isLoading />);

      const submitButton = screen.getByRole('button', { name: /send/i });
      expect(submitButton).toBeDisabled();
    });

    it('should show loading spinner in submit button', () => {
      const { container } = render(<RAGChatPanel {...defaultProps} isLoading />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not call onSendMessage when loading', () => {
      const onSendMessage = vi.fn();
      render(<RAGChatPanel {...defaultProps} onSendMessage={onSendMessage} isLoading />);

      const input = screen.getByPlaceholderText(/ask a question/i);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('sources display', () => {
    it('should render sources for assistant messages', () => {
      render(
        <RAGChatPanel
          {...defaultProps}
          messages={[
            createMessage({
              role: 'assistant',
              content: 'Here is the answer.',
              sources: [
                {
                  title: 'Source Video',
                  youtubeId: 'xyz789',
                  timestamp: '1:30',
                  timestampSeconds: 90,
                },
              ],
            }),
          ]}
        />
      );

      expect(screen.getByText('Sources')).toBeInTheDocument();
      expect(screen.getByText('Source Video')).toBeInTheDocument();
    });

    it('should not render sources section when empty', () => {
      render(
        <RAGChatPanel
          {...defaultProps}
          messages={[
            createMessage({
              role: 'assistant',
              content: 'No sources here.',
              sources: [],
            }),
          ]}
        />
      );

      expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    });
  });

  describe('seek functionality', () => {
    it('should pass onSeek to message sources', () => {
      const onSeek = vi.fn();
      render(
        <RAGChatPanel
          {...defaultProps}
          onSeek={onSeek}
          messages={[
            createMessage({
              role: 'assistant',
              content: 'Answer with source.',
              sources: [
                {
                  title: 'Test Video',
                  youtubeId: 'test123',
                  timestampSeconds: 60,
                },
              ],
            }),
          ]}
        />
      );

      // The RAGSourceCard should receive onSeek
      const jumpButton = screen.getByRole('button', { name: /jump to/i });
      fireEvent.click(jumpButton);

      expect(onSeek).toHaveBeenCalledWith(60);
    });
  });

  describe('accessibility', () => {
    it('should have sr-only label on submit button', () => {
      render(<RAGChatPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<RAGChatPanel {...defaultProps} />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
