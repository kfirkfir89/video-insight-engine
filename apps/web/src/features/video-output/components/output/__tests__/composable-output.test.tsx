import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { VIEResponse, TabEntry } from '@vie/types';

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
    travel: {
      bestSeason: 'Spring',
      accommodationTips: [],
      transportationTips: [],
      itinerary: [],
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
      tabs: [{ id: 'analysis', label: 'Music Analysis', emoji: '\u{1F3B5}', dataSource: 'music.analysis' }],
      // no music data provided
    });

    render(
      <ComposableOutput
        response={response}
        activeTab="analysis"
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

  describe('v2 overview rendering', () => {
    function buildAssembledTabs(): TabEntry[] {
      return [
        {
          id: 'overview',
          label: 'Overview',
          emoji: '📋',
          component: 'overview',
          props: {
            data: {
              keyTakeaways: ['First insight', 'Second insight', 'Third insight'],
              level: 'Advanced',
              duration: 2700, // seconds — renderer converts to "45 min"
            },
          },
        },
        {
          id: 'quizzes',
          label: '🧪 Quizzes',
          emoji: '🧪',
          component: 'quiz',
          props: { questions: [{ q: '1' }, { q: '2' }, { q: '3' }] },
        },
        {
          id: 'concepts',
          label: 'Concepts',
          emoji: '🧠',
          component: 'info_grid',
          props: { items: [{ key: 'k1', value: 'v1' }, { key: 'k2', value: 'v2' }] },
        },
      ];
    }

    it('should derive crossTabLinks from sibling tabs and render the nav grid', () => {
      render(
        <ComposableOutput
          response={null}
          tabs={buildAssembledTabs()}
          activeTab="overview"
          onNavigateTab={vi.fn()}
          videoSummaryId="vsum-1"
        />,
      );
      expect(screen.getByText('Continue exploring')).toBeInTheDocument();
      // Sibling tab buttons appear with their stripped labels.
      expect(screen.getByRole('button', { name: 'Open Quizzes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open Concepts' })).toBeInTheDocument();
      // The active overview tab itself is excluded from the grid.
      expect(screen.queryByRole('button', { name: 'Open Overview' })).not.toBeInTheDocument();
    });

    it('should infer item counts for known sibling components', () => {
      render(
        <ComposableOutput
          response={null}
          tabs={buildAssembledTabs()}
          activeTab="overview"
          onNavigateTab={vi.fn()}
          videoSummaryId="vsum-1"
        />,
      );
      // Scope the count assertion inside each nav button so we don't collide
      // with the takeaway list's own "1/2/3" numbering elsewhere on the page.
      expect(
        within(screen.getByRole('button', { name: 'Open Quizzes' })).getByText('3'),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole('button', { name: 'Open Concepts' })).getByText('2'),
      ).toBeInTheDocument();
    });

    it('should NOT render a duplicate hero card with title/subtitle/masterSummary or top takeaways', () => {
      const tabs = buildAssembledTabs();
      tabs[0].props = {
        data: {
          title: 'React Performance Masterclass',
          subtitle: 'A comprehensive guide…',
          masterSummary: 'Long-form duplicate of the page hero.',
          keyTakeaways: ['Profile before optimizing'],
        },
      };
      render(
        <ComposableOutput
          response={null}
          tabs={tabs}
          activeTab="overview"
          onNavigateTab={vi.fn()}
          videoSummaryId="vsum-1"
        />,
      );
      // The page hero (VideoHero) owns title/subtitle/masterSummary AND the
      // first six takeaways. Rendering any of them again here produced a
      // duplicate stack under the hero — see the brand-rule compliance pass.
      expect(screen.queryByText('React Performance Masterclass')).not.toBeInTheDocument();
      expect(screen.queryByText('A comprehensive guide…')).not.toBeInTheDocument();
      expect(screen.queryByText(/Long-form duplicate/)).not.toBeInTheDocument();
      expect(screen.queryByText('Profile before optimizing')).not.toBeInTheDocument();
    });
  });
});
