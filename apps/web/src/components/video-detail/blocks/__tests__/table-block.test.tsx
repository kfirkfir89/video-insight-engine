import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableBlock } from '../TableBlock';
import type { TableBlock as TableBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<TableBlockType> = {}): TableBlockType => ({
  type: 'table',
  blockId: 'block-1',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value', align: 'right' },
  ],
  rows: [
    { name: 'CPU', value: 'M2 Pro' },
    { name: 'RAM', value: '16 GB' },
    { name: 'Storage', value: '512 GB' },
  ],
  ...overrides,
});

describe('TableBlock', () => {
  describe('rendering', () => {
    it('should render column headers', () => {
      render(<TableBlock block={createMockBlock()} />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('should render row data', () => {
      render(<TableBlock block={createMockBlock()} />);

      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(screen.getByText('M2 Pro')).toBeInTheDocument();
      expect(screen.getByText('RAM')).toBeInTheDocument();
      expect(screen.getByText('16 GB')).toBeInTheDocument();
    });

    it('should render caption when present', () => {
      render(
        <TableBlock block={createMockBlock({ caption: 'Hardware Specs' })} />
      );

      expect(screen.getByText('Hardware Specs')).toBeInTheDocument();
    });

    it('should return null for empty rows', () => {
      const { container } = render(
        <TableBlock block={createMockBlock({ rows: [] })} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null for empty columns', () => {
      const { container } = render(
        <TableBlock block={createMockBlock({ columns: [] })} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('column alignment', () => {
    it('should apply right alignment class', () => {
      const { container } = render(<TableBlock block={createMockBlock()} />);

      // The "Value" header should have text-right class
      const headers = container.querySelectorAll('th');
      expect(headers[1]).toHaveClass('text-right');
    });

    it('should apply center alignment class', () => {
      const { container } = render(
        <TableBlock
          block={createMockBlock({
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'value', label: 'Value', align: 'center' },
            ],
          })}
        />
      );

      const headers = container.querySelectorAll('th');
      expect(headers[1]).toHaveClass('text-center');
    });

    it('should default to left alignment', () => {
      const { container } = render(<TableBlock block={createMockBlock()} />);

      const headers = container.querySelectorAll('th');
      expect(headers[0]).toHaveClass('text-left');
    });
  });

  describe('row highlighting', () => {
    it('should highlight specified rows', () => {
      const { container } = render(
        <TableBlock block={createMockBlock({ highlightRows: [0, 2] })} />
      );

      const bodyRows = container.querySelectorAll('tbody tr');
      expect(bodyRows[0]).toHaveClass('bg-primary/[0.06]');
      expect(bodyRows[1]).not.toHaveClass('bg-primary/[0.06]');
      expect(bodyRows[2]).toHaveClass('bg-primary/[0.06]');
    });
  });

  describe('overflow', () => {
    it('should have horizontal scroll wrapper', () => {
      const { container } = render(<TableBlock block={createMockBlock()} />);

      const scrollWrapper = container.querySelector('.overflow-x-auto');
      expect(scrollWrapper).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should render as table element', () => {
      render(<TableBlock block={createMockBlock()} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render without header icons (transparent variant)', () => {
      const { container } = render(<TableBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBe(0);
    });
  });
});
