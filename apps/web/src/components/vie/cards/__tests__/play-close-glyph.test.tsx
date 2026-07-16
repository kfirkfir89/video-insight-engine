import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlayCloseGlyph } from '../PlayCloseGlyph';

describe('PlayCloseGlyph', () => {
  it('should render the play form when open is false', () => {
    const { container } = render(<PlayCloseGlyph open={false} />);
    expect(container.querySelector('svg')?.getAttribute('data-state')).toBe('play');
  });

  it('should render the close form when open is true', () => {
    const { container } = render(<PlayCloseGlyph open />);
    expect(container.querySelector('svg')?.getAttribute('data-state')).toBe('close');
  });

  it('should draw the glyph with three line strokes', () => {
    const { container } = render(<PlayCloseGlyph open={false} />);
    expect(container.querySelectorAll('line')).toHaveLength(3);
  });

  it('should be hidden from assistive tech (label lives on the parent button)', () => {
    const { container } = render(<PlayCloseGlyph open={false} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should forward the className to the svg', () => {
    const { container } = render(<PlayCloseGlyph open={false} className="h-5 w-5" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('h-5')).toBe(true);
    expect(svg?.classList.contains('w-5')).toBe(true);
  });
});
