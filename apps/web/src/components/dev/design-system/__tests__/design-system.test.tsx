/**
 * Unit tests for Design System components
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock import.meta.env.DEV
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: true,
    },
  },
});

import { ColorPalette } from '../ColorPalette';
import { Typography } from '../Typography';
import { SpacingScale } from '../SpacingScale';
import { StatusIndicators } from '../StatusIndicators';
import { CategoryAccents } from '../CategoryAccents';

// Mock getComputedStyle for color copying
beforeAll(() => {
  Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
      getPropertyValue: () => '#ffffff',
    }),
  });
});

describe('Design System Components', () => {
  describe('ColorPalette', () => {
    it('renders all semantic colors', () => {
      render(<ColorPalette />);

      expect(screen.getByText('Color Palette')).toBeInTheDocument();
      expect(screen.getByText('background')).toBeInTheDocument();
      expect(screen.getByText('foreground')).toBeInTheDocument();
      expect(screen.getByText('primary')).toBeInTheDocument();
      expect(screen.getByText('secondary')).toBeInTheDocument();
      expect(screen.getByText('muted')).toBeInTheDocument();
      expect(screen.getByText('accent')).toBeInTheDocument();
      expect(screen.getByText('destructive')).toBeInTheDocument();
      expect(screen.getByText('border')).toBeInTheDocument();
    });

    it('has copy-to-clipboard buttons', () => {
      render(<ColorPalette />);

      const copyButtons = screen.getAllByRole('button', { name: /copy.*color/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('shows descriptions for colors', () => {
      render(<ColorPalette />);

      expect(screen.getByText('Page background')).toBeInTheDocument();
      expect(screen.getByText('Primary action color')).toBeInTheDocument();
    });
  });

  describe('Typography', () => {
    it('renders all text sizes', () => {
      render(<Typography />);

      expect(screen.getByText('Typography')).toBeInTheDocument();
      expect(screen.getByText('text-xs')).toBeInTheDocument();
      expect(screen.getByText('text-sm')).toBeInTheDocument();
      expect(screen.getByText('text-base')).toBeInTheDocument();
      expect(screen.getByText('text-lg')).toBeInTheDocument();
      expect(screen.getByText('text-xl')).toBeInTheDocument();
      expect(screen.getByText('text-2xl')).toBeInTheDocument();
      expect(screen.getByText('text-3xl')).toBeInTheDocument();
      expect(screen.getByText('text-4xl')).toBeInTheDocument();
    });

    it('renders all font weights', () => {
      render(<Typography />);

      expect(screen.getByText('font-normal')).toBeInTheDocument();
      expect(screen.getByText('font-medium')).toBeInTheDocument();
      expect(screen.getByText('font-semibold')).toBeInTheDocument();
      expect(screen.getByText('font-bold')).toBeInTheDocument();
    });

    it('shows combined example section', () => {
      render(<Typography />);

      expect(screen.getByText('Combined Example')).toBeInTheDocument();
      expect(screen.getByText('Heading Level 1')).toBeInTheDocument();
    });
  });

  describe('SpacingScale', () => {
    it('renders spacing tokens', () => {
      render(<SpacingScale />);

      expect(screen.getByText('Spacing Scale')).toBeInTheDocument();
      // Check for token header
      expect(screen.getByText('Token')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Pixels')).toBeInTheDocument();
    });

    it('shows pixel values', () => {
      render(<SpacingScale />);

      // Use getAllByText since values appear multiple times
      expect(screen.getAllByText('0px').length).toBeGreaterThan(0);
      expect(screen.getAllByText('16px').length).toBeGreaterThan(0);
      expect(screen.getAllByText('32px').length).toBeGreaterThan(0);
    });

    it('shows usage examples', () => {
      render(<SpacingScale />);

      expect(screen.getByText('Usage Examples')).toBeInTheDocument();
      expect(screen.getByText('Padding (p-4)')).toBeInTheDocument();
      expect(screen.getByText('Gap (gap-4)')).toBeInTheDocument();
    });
  });

  describe('StatusIndicators', () => {
    it('renders all status types', () => {
      render(<StatusIndicators />);

      expect(screen.getByText('Status Indicators')).toBeInTheDocument();
      // Use getAllByText since statuses appear multiple times (badge + icon section)
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Processing').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    });

    it('shows status descriptions', () => {
      render(<StatusIndicators />);

      expect(screen.getByText('Waiting to be processed')).toBeInTheDocument();
      expect(screen.getByText('Currently being processed')).toBeInTheDocument();
      expect(screen.getByText('Successfully completed')).toBeInTheDocument();
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });

    it('shows usage examples', () => {
      render(<StatusIndicators />);

      expect(screen.getByText('In Video Cards')).toBeInTheDocument();
      expect(screen.getByText('Inline Status')).toBeInTheDocument();
      expect(screen.getByText('Icon Only')).toBeInTheDocument();
    });
  });

  describe('CategoryAccents', () => {
    it('renders all 10 categories', () => {
      render(<CategoryAccents />);

      expect(screen.getByText('Category Accents')).toBeInTheDocument();
      // Categories appear in both cards and badges section
      expect(screen.getAllByText('Cooking').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Coding').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Travel').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Reviews').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Fitness').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Education').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Podcast').length).toBeGreaterThan(0);
      expect(screen.getAllByText('DIY').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gaming').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Standard').length).toBeGreaterThan(0);
    });

    it('shows CSS variable names', () => {
      render(<CategoryAccents />);

      // Each category card shows these
      const accentLabels = screen.getAllByText('--category-accent');
      expect(accentLabels.length).toBe(10);

      const softLabels = screen.getAllByText('--category-accent-soft');
      expect(softLabels.length).toBe(10);

      const surfaceLabels = screen.getAllByText('--category-surface');
      expect(surfaceLabels.length).toBe(10);
    });

    it('shows usage instructions', () => {
      render(<CategoryAccents />);

      expect(screen.getByText('Usage')).toBeInTheDocument();
      expect(screen.getByText(/Apply the category class/i)).toBeInTheDocument();
    });

    it('shows all categories as badges', () => {
      render(<CategoryAccents />);

      expect(screen.getByText('All Categories (Badges)')).toBeInTheDocument();
    });
  });
});
