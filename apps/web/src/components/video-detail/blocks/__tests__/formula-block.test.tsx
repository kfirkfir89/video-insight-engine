import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormulaBlock } from '../FormulaBlock';
import type { FormulaBlock as FormulaBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<FormulaBlockType> = {}): FormulaBlockType => ({
  type: 'formula',
  blockId: 'block-1',
  latex: 'E = mc^2',
  ...overrides,
});

describe('FormulaBlock', () => {
  describe('rendering', () => {
    it('should render latex formula', () => {
      render(<FormulaBlock block={createMockBlock()} />);

      expect(screen.getByText('E = mc^2')).toBeInTheDocument();
    });

    it('should render in code element', () => {
      const { container } = render(<FormulaBlock block={createMockBlock()} />);

      expect(container.querySelector('code')).toBeInTheDocument();
    });

    it('should return null for empty latex', () => {
      const { container } = render(<FormulaBlock block={createMockBlock({ latex: '' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('description', () => {
    it('should render description when present', () => {
      render(
        <FormulaBlock
          block={createMockBlock({
            description: 'Mass-energy equivalence formula',
          })}
        />
      );

      expect(screen.getByText('Mass-energy equivalence formula')).toBeInTheDocument();
    });

    it('should not render description for inline formulas', () => {
      render(
        <FormulaBlock
          block={createMockBlock({
            description: 'This should not appear',
            inline: true,
          })}
        />
      );

      expect(screen.queryByText('This should not appear')).not.toBeInTheDocument();
    });
  });

  describe('inline mode', () => {
    it('should render inline when inline is true', () => {
      const { container } = render(
        <FormulaBlock block={createMockBlock({ inline: true })} />
      );

      const wrapper = container.querySelector('.inline-block');
      expect(wrapper).toBeInTheDocument();
    });

    it('should not show header for inline formulas', () => {
      render(<FormulaBlock block={createMockBlock({ inline: true })} />);

      expect(screen.queryByText('Formula')).not.toBeInTheDocument();
    });

    it('should show header for block formulas', () => {
      render(<FormulaBlock block={createMockBlock()} />);

      expect(screen.getByText('Formula')).toBeInTheDocument();
    });
  });

  describe('complex formulas', () => {
    it('should render quadratic formula', () => {
      render(
        <FormulaBlock
          block={createMockBlock({
            latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
          })}
        />
      );

      expect(screen.getByText('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')).toBeInTheDocument();
    });

    it('should render integral notation', () => {
      render(
        <FormulaBlock
          block={createMockBlock({
            latex: '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
          })}
        />
      );

      expect(screen.getByText('\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have role="math"', () => {
      render(<FormulaBlock block={createMockBlock()} />);

      expect(screen.getByRole('math')).toBeInTheDocument();
    });

    it('should have aria-label with latex content', () => {
      render(<FormulaBlock block={createMockBlock()} />);

      const mathElement = screen.getByRole('math');
      expect(mathElement).toHaveAttribute('aria-label', 'E = mc^2');
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(<FormulaBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should use serif font for block formula', () => {
      const { container } = render(<FormulaBlock block={createMockBlock()} />);

      const serifElement = container.querySelector('.font-serif');
      expect(serifElement).toBeInTheDocument();
    });

    it('should center block formulas', () => {
      const { container } = render(<FormulaBlock block={createMockBlock()} />);

      const centeredElement = container.querySelector('.text-center');
      expect(centeredElement).toBeInTheDocument();
    });
  });
});
