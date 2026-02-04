import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTreeBlock } from '../FileTreeBlock';
import type { FileTreeBlock as FileTreeBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<FileTreeBlockType> = {}): FileTreeBlockType => ({
  type: 'file_tree',
  blockId: 'block-1',
  tree: [
    {
      type: 'folder',
      name: 'src',
      children: [
        { type: 'file', name: 'index.ts' },
        { type: 'file', name: 'app.tsx' },
        {
          type: 'folder',
          name: 'components',
          children: [
            { type: 'file', name: 'Button.tsx' },
          ],
        },
      ],
    },
    { type: 'file', name: 'package.json' },
  ],
  ...overrides,
});

describe('FileTreeBlock', () => {
  describe('rendering', () => {
    it('should render file tree structure', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('should render nested folders', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      expect(screen.getByText('components')).toBeInTheDocument();
    });

    it('should render files', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('app.tsx')).toBeInTheDocument();
    });

    it('should return null for empty tree', () => {
      const { container } = render(<FileTreeBlock block={createMockBlock({ tree: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('folder expansion', () => {
    it('should auto-expand first-level folders', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      // src folder should be expanded, so we can see its children
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    it('should toggle folder on click', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      // Click to collapse src folder
      const srcFolder = screen.getByText('src');
      fireEvent.click(srcFolder);

      // Files inside should no longer be visible
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    });

    it('should expand collapsed folder on click', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      // Collapse then expand
      const srcFolder = screen.getByText('src');
      fireEvent.click(srcFolder); // collapse
      fireEvent.click(srcFolder); // expand

      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    it('should toggle on keyboard Enter', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      const srcFolder = screen.getByText('src').parentElement!;
      fireEvent.keyDown(srcFolder, { key: 'Enter' });

      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    });

    it('should toggle on keyboard Space', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      const srcFolder = screen.getByText('src').parentElement!;
      fireEvent.keyDown(srcFolder, { key: ' ' });

      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    });
  });

  describe('file icons', () => {
    it('should show correct icon for TypeScript files', () => {
      const { container } = render(<FileTreeBlock block={createMockBlock()} />);

      // FileCode icon should be present for .ts files
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should show folder icon for folders', () => {
      const { container } = render(<FileTreeBlock block={createMockBlock()} />);

      // Folder icons should be present
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have tree role', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('should have treeitem role on folders', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      const treeitems = screen.getAllByRole('treeitem');
      expect(treeitems.length).toBeGreaterThan(0);
    });

    it('should have aria-expanded on folders', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      const srcTreeitem = screen.getAllByRole('treeitem')[0];
      expect(srcTreeitem).toHaveAttribute('aria-expanded');
    });

    it('should be keyboard navigable', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      const srcFolder = screen.getByText('src').parentElement!;
      expect(srcFolder).toHaveAttribute('tabIndex', '0');
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<FileTreeBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('nested expansion', () => {
    it('should independently toggle nested folders', () => {
      render(<FileTreeBlock block={createMockBlock()} />);

      // First expand the components folder if not already
      const componentsFolder = screen.getByText('components');

      // Check if Button.tsx is visible (may need to expand components first)
      if (!screen.queryByText('Button.tsx')) {
        fireEvent.click(componentsFolder);
      }

      expect(screen.getByText('Button.tsx')).toBeInTheDocument();

      // Collapse components folder
      fireEvent.click(componentsFolder);

      expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();
      // But src folder should still show other files
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });
  });
});
