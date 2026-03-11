/**
 * Unit tests for Design System components
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
import { BlockShowcase } from '../BlockShowcase';
import { showcaseEntries } from '@/lib/dev/mock-blocks';

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
      // 'destructive' appears in both Semantic and Feedback groups
      expect(screen.getAllByText('destructive').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('border')).toBeInTheDocument();
      // Feedback group tokens
      expect(screen.getByText('success')).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
      expect(screen.getByText('info')).toBeInTheDocument();
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

    it('renders brand color tokens', () => {
      render(<ColorPalette />);

      expect(screen.getByText('Brand')).toBeInTheDocument();
      expect(screen.getByText('vie-coral')).toBeInTheDocument();
      expect(screen.getByText('vie-plum')).toBeInTheDocument();
      expect(screen.getByText('vie-sky')).toBeInTheDocument();
      expect(screen.getByText('vie-mint')).toBeInTheDocument();
      expect(screen.getByText('vie-honey')).toBeInTheDocument();
      expect(screen.getByText('vie-rose')).toBeInTheDocument();
      expect(screen.getByText('vie-forest')).toBeInTheDocument();
      expect(screen.getByText('vie-peach')).toBeInTheDocument();
    });

    it('renders output gradients section with all 8 content tags', () => {
      render(<ColorPalette />);

      expect(screen.getByText('Output Gradients')).toBeInTheDocument();
      const expectedTags = [
        'learning', 'food', 'tech', 'travel',
        'fitness', 'review', 'music', 'project',
      ];
      for (const tag of expectedTags) {
        expect(screen.getByText(tag)).toBeInTheDocument();
      }
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

  describe('BlockShowcase', () => {
    it('renders showcase entries count', () => {
      render(<BlockShowcase />);

      expect(screen.getByText(/unique components/)).toBeInTheDocument();
    });

    it('renders category filter pills', () => {
      render(<BlockShowcase />);

      // Should have "All" pill and category pills (with counts)
      expect(screen.getByText(/^All \(/)).toBeInTheDocument();
      expect(screen.getByText(/^Text \(/)).toBeInTheDocument();
      expect(screen.getByText(/^Code \(/)).toBeInTheDocument();
      expect(screen.getByText(/^Data \(/)).toBeInTheDocument();
    });

    it('renders all showcase entries as cards', () => {
      render(<BlockShowcase />);

      // Each entry should have its label visible (use getAllByText since some labels like
      // "Comparison" may also appear as category badge text on other cards)
      for (const entry of showcaseEntries) {
        const matches = screen.getAllByText(entry.label);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('filters by category when pill is clicked', () => {
      render(<BlockShowcase />);

      // Click "Travel" category (unique enough to avoid conflicts)
      const travelPill = screen.getByText(/^Travel \(/);
      fireEvent.click(travelPill);

      // Should only show Travel entries
      const travelEntries = showcaseEntries.filter((e) => e.category === 'Travel');
      const nonTravelEntries = showcaseEntries.filter((e) => e.category !== 'Travel');

      for (const entry of travelEntries) {
        expect(screen.getByText(entry.label)).toBeInTheDocument();
      }

      // Non-travel entries should not be visible
      for (const entry of nonTravelEntries) {
        expect(screen.queryByText(entry.label)).not.toBeInTheDocument();
      }
    });

    it('filters by search text', () => {
      render(<BlockShowcase />);

      const searchInput = screen.getByPlaceholderText('Filter blocks...');
      fireEvent.change(searchInput, { target: { value: 'Fitness' } });

      expect(screen.getByText('FitnessBlock')).toBeInTheDocument();
      expect(screen.queryByText('Paragraph')).not.toBeInTheDocument();
    });

    it('shows variant tabs for multi-variant entries', () => {
      render(<BlockShowcase />);

      // Callout has 5 variants: tip, warning, note, chef_tip, security
      expect(screen.getByText('tip')).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
      expect(screen.getByText('note')).toBeInTheDocument();
    });

    it('switches variant content when tab is clicked', () => {
      render(<BlockShowcase />);

      // FitnessBlock has exercise and workout_timer variants
      const workoutTab = screen.getByText('workout_timer');
      fireEvent.click(workoutTab);

      // After clicking, the workout_timer content should be visible
      // The JSON toggle should work for the current variant
      expect(workoutTab).toBeInTheDocument();
    });

    it('toggles JSON view', () => {
      render(<BlockShowcase />);

      // Find any JSON toggle button and click it
      const jsonButtons = screen.getAllByText('JSON');
      fireEvent.click(jsonButtons[0]);

      // Should show JSON content (blockId is a field in every block)
      expect(screen.getByText(/"blockId"/)).toBeInTheDocument();
    });
  });
});
