import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListBlock } from '../ListBlock';

describe('ListBlock', () => {
  const items = ['First item', 'Second item', 'Third item'];

  describe('unordered (default)', () => {
    it('should render items as bullet list', () => {
      render(<ListBlock items={items} />);
      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('Second item')).toBeInTheDocument();
      expect(screen.getByText('Third item')).toBeInTheDocument();
    });

    it('should render as ul element', () => {
      const { container } = render(<ListBlock items={items} />);
      expect(container.querySelector('ul')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should render ingredients variant with icon', () => {
      render(<ListBlock items={items} variant="ingredients" />);
      expect(screen.getByText('ingredients')).toBeInTheDocument();
    });

    it('should render checklist variant', () => {
      const { container } = render(<ListBlock items={items} variant="checklist" />);
      expect(container.querySelector('ul')).toBeInTheDocument();
    });
  });

  it('should return null for empty items', () => {
    const { container } = render(<ListBlock items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
