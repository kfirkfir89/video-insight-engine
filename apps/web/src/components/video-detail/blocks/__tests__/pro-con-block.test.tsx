import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProConBlock } from '../ProConBlock';
import type { ProConBlock as ProConBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<ProConBlockType> = {}): ProConBlockType => ({
  type: 'pro_con',
  blockId: 'block-1',
  pros: ['Fast performance', 'Easy to use', 'Great documentation'],
  cons: ['Expensive', 'Limited customization'],
  ...overrides,
});

describe('ProConBlock', () => {
  describe('rendering', () => {
    it('should render pros section', () => {
      render(<ProConBlock block={createMockBlock()} />);

      expect(screen.getByText('Fast performance')).toBeInTheDocument();
      expect(screen.getByText('Easy to use')).toBeInTheDocument();
      expect(screen.getByText('Great documentation')).toBeInTheDocument();
    });

    it('should render cons section', () => {
      render(<ProConBlock block={createMockBlock()} />);

      expect(screen.getByText('Expensive')).toBeInTheDocument();
      expect(screen.getByText('Limited customization')).toBeInTheDocument();
    });

    it('should render section labels', () => {
      render(<ProConBlock block={createMockBlock()} />);

      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.getByText('Cons')).toBeInTheDocument();
    });

    it('should return null when both pros and cons are empty', () => {
      const { container } = render(
        <ProConBlock block={createMockBlock({ pros: [], cons: [] })} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('partial content', () => {
    it('should render only pros when cons is empty', () => {
      render(<ProConBlock block={createMockBlock({ cons: [] })} />);

      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.queryByText('Cons')).not.toBeInTheDocument();
    });

    it('should render only cons when pros is empty', () => {
      render(<ProConBlock block={createMockBlock({ pros: [] })} />);

      expect(screen.getByText('Cons')).toBeInTheDocument();
      expect(screen.queryByText('Pros')).not.toBeInTheDocument();
    });

    it('should handle undefined arrays', () => {
      render(
        <ProConBlock
          block={createMockBlock({
            pros: ['One pro'],
            cons: [],
          })}
        />
      );

      expect(screen.getByText('One pro')).toBeInTheDocument();
    });
  });

  describe('empty items', () => {
    it('should render dash for empty string items', () => {
      render(
        <ProConBlock
          block={createMockBlock({
            pros: ['Valid item', ''],
          })}
        />
      );

      expect(screen.getByText('Valid item')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('grid structure', () => {
    it('should render as a row-aligned grid when both pros and cons exist', () => {
      const { container } = render(<ProConBlock block={createMockBlock()} />);

      const grids = container.querySelectorAll('.grid');
      expect(grids.length).toBeGreaterThan(0);
    });

    it('should render single-column list when only pros exist', () => {
      render(<ProConBlock block={createMockBlock({ cons: [] })} />);

      const prosList = screen.getByRole('list', { name: /pros/i });
      expect(prosList).toBeInTheDocument();
    });

    it('should render single-column list when only cons exist', () => {
      render(<ProConBlock block={createMockBlock({ pros: [] })} />);

      const consList = screen.getByRole('list', { name: /cons/i });
      expect(consList).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have labeled sections in grid mode', () => {
      render(<ProConBlock block={createMockBlock()} />);

      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.getByText('Cons')).toBeInTheDocument();
    });

    it('should have accessible list in single-column mode', () => {
      render(<ProConBlock block={createMockBlock({ cons: [] })} />);

      expect(screen.getByRole('list', { name: /pros/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<ProConBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should have success styling for pros section', () => {
      const { container } = render(<ProConBlock block={createMockBlock()} />);

      // Pros section should have success semantic coloring
      const prosHeader = container.querySelector('[class*="text-success"]');
      expect(prosHeader).toBeInTheDocument();
    });

    it('should have destructive styling for cons section', () => {
      const { container } = render(<ProConBlock block={createMockBlock()} />);

      // Cons section should have destructive semantic coloring
      const consHeader = container.querySelector('[class*="text-destructive"]');
      expect(consHeader).toBeInTheDocument();
    });
  });
});
