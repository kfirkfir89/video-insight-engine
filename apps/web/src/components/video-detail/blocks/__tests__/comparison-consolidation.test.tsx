import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContentBlockRenderer } from '../../ContentBlockRenderer';

describe('Block Consolidation — do_dont and pro_con through ComparisonRenderer', () => {
  describe('do_dont block', () => {
    it('should render do_dont through ComparisonRenderer with Do and Don\'t headers', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'do_dont',
            do: ['Use semantic HTML', 'Write tests'],
            dont: ['Skip accessibility', 'Ignore errors'],
          } as any}
        />,
      );

      // ComparisonRenderer renders labels in uppercase via CSS, but text content is "Do" / "Don't"
      expect(screen.getByText('Do')).toBeInTheDocument();
      expect(screen.getByText("Don't")).toBeInTheDocument();
    });

    it('should render do items as list entries', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'do_dont',
            do: ['Use semantic HTML'],
            dont: ['Skip accessibility'],
          } as any}
        />,
      );

      expect(screen.getByText('Use semantic HTML')).toBeInTheDocument();
      expect(screen.getByText('Skip accessibility')).toBeInTheDocument();
    });

    it('should handle empty do/dont arrays gracefully', () => {
      const { container } = render(
        <ContentBlockRenderer
          block={{
            type: 'do_dont',
            do: [],
            dont: [],
          } as any}
        />,
      );

      // Should still render the comparison structure with headers
      expect(screen.getByText('Do')).toBeInTheDocument();
      expect(screen.getByText("Don't")).toBeInTheDocument();
      // No list items rendered
      expect(container.querySelectorAll('.text-muted-foreground span')).toHaveLength(0);
    });

    it('should handle missing do/dont properties', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'do_dont',
          } as any}
        />,
      );

      // Should render with fallback empty arrays, headers still show
      expect(screen.getByText('Do')).toBeInTheDocument();
      expect(screen.getByText("Don't")).toBeInTheDocument();
    });
  });

  describe('pro_con block', () => {
    it('should render pro_con through ComparisonRenderer with Pros and Cons headers', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'pro_con',
            pros: ['Fast performance', 'Easy to use'],
            cons: ['Steep learning curve', 'Limited plugins'],
          } as any}
        />,
      );

      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.getByText('Cons')).toBeInTheDocument();
    });

    it('should render pros and cons items as list entries', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'pro_con',
            pros: ['Fast performance'],
            cons: ['Steep learning curve'],
          } as any}
        />,
      );

      expect(screen.getByText('Fast performance')).toBeInTheDocument();
      expect(screen.getByText('Steep learning curve')).toBeInTheDocument();
    });

    it('should handle empty pros/cons arrays gracefully', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'pro_con',
            pros: [],
            cons: [],
          } as any}
        />,
      );

      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.getByText('Cons')).toBeInTheDocument();
    });

    it('should handle missing pros/cons properties', () => {
      render(
        <ContentBlockRenderer
          block={{
            type: 'pro_con',
          } as any}
        />,
      );

      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.getByText('Cons')).toBeInTheDocument();
    });
  });
});
