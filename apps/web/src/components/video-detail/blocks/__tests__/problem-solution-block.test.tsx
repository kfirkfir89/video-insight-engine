import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProblemSolutionBlock } from '../ProblemSolutionBlock';
import type { ProblemSolutionBlock as ProblemSolutionBlockType } from '@vie/types';

const createMockBlock = (
  overrides: Partial<ProblemSolutionBlockType> = {}
): ProblemSolutionBlockType => ({
  type: 'problem_solution',
  blockId: 'block-ps-1',
  problem: 'The application crashes when users submit empty forms.',
  solution: 'Add client-side validation with Zod schemas before submission.',
  ...overrides,
});

describe('ProblemSolutionBlock', () => {
  describe('rendering', () => {
    it('should render problem text', () => {
      render(<ProblemSolutionBlock block={createMockBlock()} />);

      expect(
        screen.getByText('The application crashes when users submit empty forms.')
      ).toBeInTheDocument();
    });

    it('should render solution text', () => {
      render(<ProblemSolutionBlock block={createMockBlock()} />);

      expect(
        screen.getByText(
          'Add client-side validation with Zod schemas before submission.'
        )
      ).toBeInTheDocument();
    });

    it('should render Problem and Solution labels', () => {
      render(<ProblemSolutionBlock block={createMockBlock()} />);

      expect(screen.getByText('Problem')).toBeInTheDocument();
      expect(screen.getByText('Solution')).toBeInTheDocument();
    });

    it('should render context when provided', () => {
      render(
        <ProblemSolutionBlock
          block={createMockBlock({
            context: 'This affects 30% of form submissions.',
          })}
        />
      );

      expect(
        screen.getByText('This affects 30% of form submissions.')
      ).toBeInTheDocument();
    });

    it('should not render context section when not provided', () => {
      const { container } = render(
        <ProblemSolutionBlock block={createMockBlock()} />
      );

      // Only 2 sections (problem + solution), no third context section
      const sections = container.querySelectorAll('.bg-muted\\/\\[0\\.03\\]');
      expect(sections.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should return null when both problem and solution are empty', () => {
      const { container } = render(
        <ProblemSolutionBlock
          block={createMockBlock({ problem: '', solution: '' })}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render only problem when solution is empty', () => {
      render(
        <ProblemSolutionBlock
          block={createMockBlock({ solution: '' })}
        />
      );

      expect(
        screen.getByText('The application crashes when users submit empty forms.')
      ).toBeInTheDocument();
      expect(screen.queryByText('Solution')).not.toBeInTheDocument();
    });

    it('should render only solution when problem is empty', () => {
      render(
        <ProblemSolutionBlock
          block={createMockBlock({ problem: '' })}
        />
      );

      expect(
        screen.getByText(
          'Add client-side validation with Zod schemas before submission.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText('Problem')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have destructive background for problem section', () => {
      const { container } = render(
        <ProblemSolutionBlock block={createMockBlock()} />
      );

      const problemSection = container.querySelector(
        '.bg-destructive\\/\\[0\\.04\\]'
      );
      expect(problemSection).toBeInTheDocument();
    });

    it('should have success background for solution section', () => {
      const { container } = render(
        <ProblemSolutionBlock block={createMockBlock()} />
      );

      const solutionSection = container.querySelector(
        '.bg-success\\/\\[0\\.04\\]'
      );
      expect(solutionSection).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(
        <ProblemSolutionBlock block={createMockBlock()} />
      );
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have aria-label on wrapper', () => {
      const { container } = render(
        <ProblemSolutionBlock block={createMockBlock()} />
      );
      const section = container.querySelector(
        '[aria-label="Problem & Solution"]'
      );
      expect(section).toBeInTheDocument();
    });
  });
});
