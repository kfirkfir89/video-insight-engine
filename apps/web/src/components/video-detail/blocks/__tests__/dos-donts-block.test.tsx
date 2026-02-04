import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DosDontsBlock } from '../DosDontsBlock';
import type { DoDoNotBlock } from '@vie/types';

const createMockBlock = (
  overrides: Partial<DoDoNotBlock> = {}
): DoDoNotBlock => ({
  type: 'do_dont',
  blockId: 'block-1',
  do: ['Do this', 'And this'],
  dont: ["Don't do this", "Avoid that"],
  ...overrides,
});

describe('DosDontsBlock', () => {
  describe('rendering', () => {
    it('should render do and dont items', () => {
      render(<DosDontsBlock block={createMockBlock()} />);

      expect(screen.getByText('Do this')).toBeInTheDocument();
      expect(screen.getByText('And this')).toBeInTheDocument();
      expect(screen.getByText("Don't do this")).toBeInTheDocument();
      expect(screen.getByText('Avoid that')).toBeInTheDocument();
    });

    it('should render column headers', () => {
      render(<DosDontsBlock block={createMockBlock()} />);

      expect(screen.getByText('Do')).toBeInTheDocument();
      expect(screen.getByText("Don't")).toBeInTheDocument();
    });

    it('should return null when both arrays are empty', () => {
      const { container } = render(
        <DosDontsBlock block={createMockBlock({ do: [], dont: [] })} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null when arrays are missing', () => {
      const { container } = render(
        <DosDontsBlock block={{ type: 'do_dont' } as DoDoNotBlock} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('partial content', () => {
    it('should render only dos when donts are empty', () => {
      render(<DosDontsBlock block={createMockBlock({ dont: [] })} />);

      expect(screen.getByText('Do this')).toBeInTheDocument();
      expect(screen.getByText('Do')).toBeInTheDocument();
      expect(screen.queryByText("Don't")).not.toBeInTheDocument();
    });

    it('should render only donts when dos are empty', () => {
      render(<DosDontsBlock block={createMockBlock({ do: [] })} />);

      expect(screen.getByText("Don't do this")).toBeInTheDocument();
      expect(screen.getByText("Don't")).toBeInTheDocument();
      expect(screen.queryByText('Do')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible lists', () => {
      render(<DosDontsBlock block={createMockBlock()} />);

      const lists = screen.getAllByRole('list');
      expect(lists).toHaveLength(2);
    });

    it('should have aria-label on lists', () => {
      render(<DosDontsBlock block={createMockBlock()} />);

      expect(screen.getByRole('list', { name: 'Do' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: "Don't" })).toBeInTheDocument();
    });

    it('should have list items', () => {
      render(<DosDontsBlock block={createMockBlock()} />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
    });

    it('should have aria-hidden on icons', () => {
      render(<DosDontsBlock block={createMockBlock()} />);

      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should render in a grid layout', () => {
      const { container } = render(<DosDontsBlock block={createMockBlock()} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should render with border', () => {
      const { container } = render(<DosDontsBlock block={createMockBlock()} />);

      const wrapper = container.querySelector('.border');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
