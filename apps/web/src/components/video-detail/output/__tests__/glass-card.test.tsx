import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlassCard } from '../GlassCard';

describe('GlassCard', () => {
  describe('rendering', () => {
    it('should render children', () => {
      render(
        <GlassCard>
          <p>Card content</p>
        </GlassCard>,
      );

      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('should render complex children', () => {
      render(
        <GlassCard>
          <h2>Title</h2>
          <p>Description</p>
          <button>Action</button>
        </GlassCard>,
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should apply default variant styles when no variant is specified', () => {
      const { container } = render(
        <GlassCard>
          <p>Default card</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('bg-[var(--glass-bg)]');
      expect(card.className).toContain('shadow-[var(--glass-shadow)]');
      expect(card.className).not.toContain('shadow-lg');
      expect(card.className).not.toContain('bg-transparent');
      expect(card.className).not.toContain('hover:shadow-lg');
    });

    it('should apply elevated variant styles', () => {
      const { container } = render(
        <GlassCard variant="elevated">
          <p>Elevated card</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('bg-[var(--glass-bg)]');
      expect(card.className).toContain('shadow-lg');
    });

    it('should apply outlined variant styles', () => {
      const { container } = render(
        <GlassCard variant="outlined">
          <p>Outlined card</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('bg-transparent');
      expect(card.className).toContain('border-2');
    });

    it('should apply interactive variant styles', () => {
      const { container } = render(
        <GlassCard variant="interactive">
          <p>Interactive card</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('hover:shadow-lg');
      expect(card.className).toContain('hover:-translate-y-0.5');
      expect(card.className).toContain('transition-all');
    });
  });

  describe('className', () => {
    it('should accept and apply additional className', () => {
      const { container } = render(
        <GlassCard className="my-custom-class">
          <p>Custom class card</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('my-custom-class');
    });

    it('should merge className with base and variant styles', () => {
      const { container } = render(
        <GlassCard variant="outlined" className="mt-4">
          <p>Merged styles card</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('rounded-2xl');
      expect(card.className).toContain('p-5');
      expect(card.className).toContain('bg-transparent');
      expect(card.className).toContain('mt-4');
    });
  });

  describe('base styles', () => {
    it('should always apply base rounding, padding, and backdrop blur', () => {
      const { container } = render(
        <GlassCard>
          <p>Base styles</p>
        </GlassCard>,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('rounded-2xl');
      expect(card.className).toContain('p-5');
      expect(card.className).toContain('backdrop-blur-[var(--glass-blur,20px)]');
    });

    it('should render as a div element', () => {
      const { container } = render(
        <GlassCard>
          <p>Div check</p>
        </GlassCard>,
      );

      expect(container.firstElementChild?.tagName).toBe('DIV');
    });
  });
});
