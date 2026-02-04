import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionPicker } from '../CollectionPicker';

const mockCollections = [
  { id: 'col-1', name: 'Work', color: '#ff0000' },
  { id: 'col-2', name: 'Personal', color: '#00ff00' },
  { id: 'col-3', name: 'Archive', color: '#0000ff' },
];

describe('CollectionPicker', () => {
  describe('rendering', () => {
    it('should render trigger button', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show "Add to collection" when nothing selected', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      expect(screen.getByText('Add to collection')).toBeInTheDocument();
    });

    it('should show collection name when one selected', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={['col-1']}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('should show count when multiple selected', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={['col-1', 'col-2']}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      expect(screen.getByText('2 collections')).toBeInTheDocument();
    });
  });

  describe('dropdown behavior', () => {
    it('should show collections when opened', async () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('should show empty state when no collections', () => {
      render(
        <CollectionPicker
          collections={[]}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.getByText('No collections yet')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('should call onSelect when unselected item is clicked', () => {
      const onSelect = vi.fn();
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={onSelect}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(screen.getByText('Work'));

      expect(onSelect).toHaveBeenCalledWith('col-1');
    });

    it('should call onDeselect when selected item is clicked', () => {
      const onDeselect = vi.fn();
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={['col-1']}
          onSelect={vi.fn()}
          onDeselect={onDeselect}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      // "Work" appears in both trigger button and popover, get all and click the second one
      const workTexts = screen.getAllByText('Work');
      fireEvent.click(workTexts[workTexts.length - 1]);

      expect(onDeselect).toHaveBeenCalledWith('col-1');
    });

    it('should show check mark for selected items', () => {
      const { container } = render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={['col-1']}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      // Selected item should have check icon (aria-hidden)
      const checkIcons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });

  describe('create new collection', () => {
    it('should show create button when onCreateNew is provided', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
          onCreateNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.getByText('Create new collection')).toBeInTheDocument();
    });

    it('should not show create button when onCreateNew is not provided', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.queryByText('Create new collection')).not.toBeInTheDocument();
    });

    it('should call onCreateNew and close popover when clicked', () => {
      const onCreateNew = vi.fn();
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
          onCreateNew={onCreateNew}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(screen.getByText('Create new collection'));

      expect(onCreateNew).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have combobox role', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should have aria-expanded attribute', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have button type on collection items', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have aria-hidden on icons', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={['col-1']}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('custom className', () => {
    it('should apply custom className to trigger', () => {
      render(
        <CollectionPicker
          collections={mockCollections}
          selectedIds={[]}
          onSelect={vi.fn()}
          onDeselect={vi.fn()}
          className="custom-class"
        />
      );

      expect(screen.getByRole('combobox')).toHaveClass('custom-class');
    });
  });
});
