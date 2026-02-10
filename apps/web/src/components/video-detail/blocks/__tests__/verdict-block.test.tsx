import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerdictBlock } from '../VerdictBlock';
import type { VerdictBlock as VerdictBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<VerdictBlockType> = {}): VerdictBlockType => ({
  type: 'verdict',
  blockId: 'block-1',
  verdict: 'recommended',
  summary: 'This product is excellent for most users.',
  ...overrides,
});

describe('VerdictBlock', () => {
  describe('rendering', () => {
    it('should render summary', () => {
      render(<VerdictBlock block={createMockBlock()} />);

      expect(screen.getByText('This product is excellent for most users.')).toBeInTheDocument();
    });

    it('should render verdict label', () => {
      render(<VerdictBlock block={createMockBlock()} />);

      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('should return null when summary is empty', () => {
      const { container } = render(<VerdictBlock block={createMockBlock({ summary: '' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('verdict types', () => {
    it('should render recommended verdict', () => {
      render(<VerdictBlock block={createMockBlock({ verdict: 'recommended' })} />);

      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('should render not_recommended verdict', () => {
      render(<VerdictBlock block={createMockBlock({ verdict: 'not_recommended' })} />);

      expect(screen.getByText('Not Recommended')).toBeInTheDocument();
    });

    it('should render conditional verdict', () => {
      render(<VerdictBlock block={createMockBlock({ verdict: 'conditional' })} />);

      expect(screen.getByText('Conditional')).toBeInTheDocument();
    });

    it('should render neutral verdict', () => {
      render(<VerdictBlock block={createMockBlock({ verdict: 'neutral' })} />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('should default to neutral for unknown verdict', () => {
      render(<VerdictBlock block={createMockBlock({ verdict: 'unknown' as any })} />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });
  });

  describe('best for / not for lists', () => {
    it('should render bestFor list', () => {
      render(
        <VerdictBlock
          block={createMockBlock({
            bestFor: ['Beginners', 'Budget-conscious buyers'],
          })}
        />
      );

      expect(screen.getByText('Beginners')).toBeInTheDocument();
      expect(screen.getByText('Budget-conscious buyers')).toBeInTheDocument();
    });

    it('should render notFor list', () => {
      render(
        <VerdictBlock
          block={createMockBlock({
            notFor: ['Professional users', 'Heavy workloads'],
          })}
        />
      );

      expect(screen.getByText('Professional users')).toBeInTheDocument();
      expect(screen.getByText('Heavy workloads')).toBeInTheDocument();
    });

    it('should render both bestFor and notFor', () => {
      render(
        <VerdictBlock
          block={createMockBlock({
            bestFor: ['Casual users'],
            notFor: ['Power users'],
          })}
        />
      );

      expect(screen.getByText('Casual users')).toBeInTheDocument();
      expect(screen.getByText('Power users')).toBeInTheDocument();
    });

    it('should not render section when lists are empty', () => {
      render(<VerdictBlock block={createMockBlock({ bestFor: [], notFor: [] })} />);

      expect(screen.queryByText('Best for')).not.toBeInTheDocument();
      expect(screen.queryByText('Not for')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have success styling for recommended', () => {
      const { container } = render(
        <VerdictBlock block={createMockBlock({ verdict: 'recommended' })} />
      );

      const card = container.querySelector('.bg-success\\/\\[0\\.06\\]');
      expect(card).toBeInTheDocument();
    });

    it('should have destructive styling for not_recommended', () => {
      const { container } = render(
        <VerdictBlock block={createMockBlock({ verdict: 'not_recommended' })} />
      );

      const card = container.querySelector('.bg-destructive\\/\\[0\\.06\\]');
      expect(card).toBeInTheDocument();
    });

    it('should have warning styling for conditional', () => {
      const { container } = render(
        <VerdictBlock block={createMockBlock({ verdict: 'conditional' })} />
      );

      const card = container.querySelector('.bg-warning\\/\\[0\\.06\\]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<VerdictBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
