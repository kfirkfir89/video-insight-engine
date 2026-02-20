import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepBlock } from '../StepBlock';
import type { StepBlock as StepBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<StepBlockType> = {}): StepBlockType => ({
  type: 'step',
  blockId: 'block-1',
  steps: [
    { number: 1, instruction: 'Preheat oven to 350°F' },
    { number: 2, instruction: 'Mix dry ingredients', duration: 300, tips: 'Sift for best results' },
    { number: 3, instruction: 'Bake for 25 minutes', duration: 1500 },
  ],
  ...overrides,
});

describe('StepBlock', () => {
  describe('rendering', () => {
    it('should render all steps', () => {
      render(<StepBlock block={createMockBlock()} />);

      expect(screen.getByText('Preheat oven to 350°F')).toBeInTheDocument();
      expect(screen.getByText('Mix dry ingredients')).toBeInTheDocument();
      expect(screen.getByText('Bake for 25 minutes')).toBeInTheDocument();
    });

    it('should display step numbers', () => {
      render(<StepBlock block={createMockBlock()} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should return null for empty steps', () => {
      const { container } = render(<StepBlock block={createMockBlock({ steps: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('duration formatting', () => {
    it('should format seconds correctly', () => {
      render(
        <StepBlock
          block={createMockBlock({
            steps: [{ number: 1, instruction: 'Quick step', duration: 30 }],
          })}
        />
      );

      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('should format minutes correctly', () => {
      render(
        <StepBlock
          block={createMockBlock({
            steps: [{ number: 1, instruction: 'Medium step', duration: 300 }],
          })}
        />
      );

      expect(screen.getByText('5m')).toBeInTheDocument();
    });

    it('should format minutes and seconds', () => {
      render(
        <StepBlock
          block={createMockBlock({
            steps: [{ number: 1, instruction: 'Long step', duration: 90 }],
          })}
        />
      );

      expect(screen.getByText('1m 30s')).toBeInTheDocument();
    });
  });

  describe('tips display', () => {
    it('should display tips when present', () => {
      render(<StepBlock block={createMockBlock()} />);

      expect(screen.getByText(/tip:/i)).toBeInTheDocument();
      expect(screen.getByText(/sift for best results/i)).toBeInTheDocument();
    });
  });

  describe('step completion', () => {
    it('should toggle step completed state', () => {
      render(<StepBlock block={createMockBlock()} />);

      const step1Button = screen.getByRole('button', { name: /mark step 1 complete/i });
      fireEvent.click(step1Button);

      expect(screen.getByRole('button', { name: /mark step 1 incomplete/i })).toBeInTheDocument();
    });

    it('should apply opacity when completed', () => {
      render(<StepBlock block={createMockBlock()} />);

      const step1Button = screen.getByRole('button', { name: /mark step 1 complete/i });
      fireEvent.click(step1Button);

      const stepContainer = step1Button.closest('.step-connector');
      expect(stepContainer).toHaveClass('opacity-60');
    });

    it('should apply strikethrough to completed step text', () => {
      render(<StepBlock block={createMockBlock()} />);

      const step1Button = screen.getByRole('button', { name: /mark step 1 complete/i });
      fireEvent.click(step1Button);

      const instructionContainer = screen.getByText('Preheat oven to 350°F').parentElement;
      expect(instructionContainer).toHaveClass('line-through');
    });

    it('should uncheck completed step', () => {
      render(<StepBlock block={createMockBlock()} />);

      const step1Button = screen.getByRole('button', { name: /mark step 1 complete/i });
      fireEvent.click(step1Button); // Complete
      fireEvent.click(screen.getByRole('button', { name: /mark step 1 incomplete/i })); // Uncomplete

      expect(screen.getByRole('button', { name: /mark step 1 complete/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible button labels', () => {
      render(<StepBlock block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /mark step 1 complete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mark step 2 complete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mark step 3 complete/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(<StepBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
