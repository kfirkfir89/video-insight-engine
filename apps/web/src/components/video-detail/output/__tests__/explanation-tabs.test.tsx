import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ExplanationOutput } from '@vie/types';
import { ExplanationTabs } from '../output-views/ExplanationTabs';

const mockData: ExplanationOutput = {
  keyPoints: [
    { emoji: '1', title: 'First Point', detail: 'Detail about the first point that is quite long', timestamp: 45 },
    { emoji: '2', title: 'Second Point', detail: 'Detail about the second point', timestamp: 120 },
  ],
  concepts: [
    { name: 'Concept A', definition: 'Definition of concept A', emoji: 'A' },
    { name: 'Concept B', definition: 'Definition of concept B', emoji: 'B' },
  ],
  takeaways: [
    'First takeaway action',
    'Second takeaway action',
    'Third takeaway action',
  ],
  timestamps: [
    { time: '0:45', seconds: 45, label: 'Introduction' },
    { time: '2:00', seconds: 120, label: 'Main content' },
  ],
};

describe('ExplanationTabs', () => {
  describe('key_points tab', () => {
    it('should render key points with titles', () => {
      render(<ExplanationTabs data={mockData} activeTab="key_points" />);
      expect(screen.getByText('First Point')).toBeInTheDocument();
      expect(screen.getByText('Second Point')).toBeInTheDocument();
    });

    it('should render timestamp badges', () => {
      render(<ExplanationTabs data={mockData} activeTab="key_points" />);
      expect(screen.getByText('0:45')).toBeInTheDocument();
      expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('should expand point on click', async () => {
      const user = userEvent.setup();
      render(<ExplanationTabs data={mockData} activeTab="key_points" />);

      const btn = screen.getByRole('button', { name: /First Point/i });
      expect(btn).toHaveAttribute('aria-expanded', 'false');

      await user.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse expanded point on second click', async () => {
      const user = userEvent.setup();
      render(<ExplanationTabs data={mockData} activeTab="key_points" />);

      const btn = screen.getByRole('button', { name: /First Point/i });
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');

      await user.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('concepts tab', () => {
    it('should render concepts in grid', () => {
      render(<ExplanationTabs data={mockData} activeTab="concepts" />);
      expect(screen.getByText('Concept A')).toBeInTheDocument();
      expect(screen.getByText('Concept B')).toBeInTheDocument();
    });

    it('should expand concept on click', async () => {
      const user = userEvent.setup();
      render(<ExplanationTabs data={mockData} activeTab="concepts" />);

      const btn = screen.getByRole('button', { name: /Concept A/i });
      expect(btn).toHaveAttribute('aria-expanded', 'false');

      await user.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('takeaways tab', () => {
    it('should render takeaway items', () => {
      render(<ExplanationTabs data={mockData} activeTab="takeaways" />);
      expect(screen.getByText('First takeaway action')).toBeInTheDocument();
      expect(screen.getByText('Second takeaway action')).toBeInTheDocument();
    });

    it('should toggle checkbox on click', async () => {
      const user = userEvent.setup();
      render(<ExplanationTabs data={mockData} activeTab="takeaways" />);

      const btn = screen.getByRole('button', { name: /First takeaway/i });
      expect(btn).toHaveAttribute('aria-pressed', 'false');

      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show progress counter after checking items', async () => {
      const user = userEvent.setup();
      render(<ExplanationTabs data={mockData} activeTab="takeaways" />);

      await user.click(screen.getByRole('button', { name: /First takeaway/i }));
      expect(screen.getByText('1 of 3 completed')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Second takeaway/i }));
      expect(screen.getByText('2 of 3 completed')).toBeInTheDocument();
    });

    it('should uncheck on second click', async () => {
      const user = userEvent.setup();
      render(<ExplanationTabs data={mockData} activeTab="takeaways" />);

      const btn = screen.getByRole('button', { name: /First takeaway/i });
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'true');

      await user.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('timestamps tab', () => {
    it('should render timestamps with time badges', () => {
      render(<ExplanationTabs data={mockData} activeTab="timestamps" />);
      expect(screen.getByText('0:45')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('2:00')).toBeInTheDocument();
      expect(screen.getByText('Main content')).toBeInTheDocument();
    });
  });

  describe('unknown tab', () => {
    it('should return null for unknown activeTab', () => {
      const { container } = render(<ExplanationTabs data={mockData} activeTab="unknown" />);
      expect(container.innerHTML).toBe('');
    });
  });
});
