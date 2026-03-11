import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { VIEResponse } from '@vie/types';

// Mock cross-tab link dependencies
vi.mock('../CrossTabLink', () => ({
  CrossTabLink: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock('../link-rules', () => ({
  resolveCrossTabLinks: () => ({}),
}));

import { ComposableOutput } from '../ComposableOutput';

const baseMeta = {
  videoId: 'v1',
  videoTitle: 'Test Video',
  creator: 'Tester',
  contentTags: ['travel' as const],
  modifiers: [],
  primaryTag: 'travel' as const,
  userGoal: 'Plan a trip',
};

function buildResponse(overrides: Partial<VIEResponse> = {}): VIEResponse {
  return {
    meta: baseMeta,
    tabs: [
      { id: 'itinerary', label: 'Itinerary', emoji: '\u{1F5FA}', dataSource: 'travel' },
      { id: 'budget', label: 'Budget', emoji: '\u{1F4B0}', dataSource: 'travel' },
    ],
    sections: [],
    travel: {
      destination: 'Tokyo',
      totalDays: 5,
      days: [],
      budget: { total: 3000, currency: 'USD', breakdown: [] },
      packingList: [],
    },
    ...overrides,
  };
}

describe('ComposableOutput', () => {
  it('should render content for the active tab', () => {
    const response = buildResponse();
    const { container } = render(
      <ComposableOutput
        response={response}
        activeTab="itinerary"
        onNavigateTab={vi.fn()}
      />,
    );

    // ComposableOutput renders either an interactive component or DisplaySection
    // The container should not be empty when a valid tab is active
    expect(container.innerHTML).not.toBe('');
  });

  it('should return null when active tab is not found', () => {
    const response = buildResponse();
    const { container } = render(
      <ComposableOutput
        response={response}
        activeTab="nonexistent"
        onNavigateTab={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should show fallback when domain data is missing', () => {
    const response = buildResponse({
      tabs: [{ id: 'overview', label: 'Music', emoji: '\u{1F3B5}', dataSource: 'music' }],
      // no music data provided
    });

    render(
      <ComposableOutput
        response={response}
        activeTab="overview"
        onNavigateTab={vi.fn()}
      />,
    );

    // DisplaySection renders "No data available for this section." when data is null
    expect(screen.getByText('No data available for this section.')).toBeInTheDocument();
  });

  it('should render DisplaySection for tabs without interactive mapping', () => {
    const response = buildResponse({
      tabs: [{ id: 'overview', label: 'Overview', emoji: '\u{1F4D6}', dataSource: 'travel' }],
    });

    const { container } = render(
      <ComposableOutput
        response={response}
        activeTab="overview"
        onNavigateTab={vi.fn()}
      />,
    );

    // "overview" is not in TAB_INTERACTIVE_MAP, so DisplaySection is used
    expect(container.innerHTML).not.toBe('');
  });

  it('should render content for interactive tab types', () => {
    const response = buildResponse({
      tabs: [{ id: 'ingredients', label: 'Ingredients', emoji: '\u{1F952}', dataSource: 'food' }],
      food: {
        meta: { servings: 4 },
        ingredients: [{ name: 'Pasta', amount: '500g' }],
        steps: [],
        tips: [],
        substitutions: [],
        nutrition: [],
        equipment: [],
      },
    });

    const { container } = render(
      <ComposableOutput
        response={response}
        activeTab="ingredients"
        onNavigateTab={vi.fn()}
      />,
    );

    // "ingredients" is in TAB_INTERACTIVE_MAP (ChecklistInteractive)
    expect(container.innerHTML).not.toBe('');
  });
});
