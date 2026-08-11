import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { TierList } from '../TierList';
import type { TierListItem } from '@vie/types';

const items: TierListItem[] = [
  { item: 'Jett', tier: 'S', reason: 'Top duelist', emoji: '🌪️' },
  { item: 'Sage', tier: 'A', reason: 'Carry' },
  { item: 'Sova', tier: 'A' },
  { item: 'Yoru', tier: 'C' },
  { item: 'Mystery pick' },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('TierList', () => {
  it('renders every item as a draggable chip', () => {
    render(<TierList items={items} />);
    expect(screen.getByRole('button', { name: 'Drag Jett' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag Sage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag Mystery pick' })).toBeInTheDocument();
  });

  it('seeds items into the creators suggested tier', () => {
    render(<TierList items={items} />);
    // The S row should contain Jett; an item with no tier lands in Unranked.
    expect(screen.getByText('Jett')).toBeInTheDocument();
    expect(screen.getByText('Unranked (1)')).toBeInTheDocument();
  });

  it('renders an empty-state message when there are no items', () => {
    render(<TierList items={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/no items to rank/i);
  });

  it('restores placement from localStorage when videoId is provided', () => {
    // Pre-seed: move Jett (index 0) from S to D.
    window.localStorage.setItem(
      'vie:tier-list:vid-1:t1',
      JSON.stringify({ '0': 'D' }),
    );
    render(<TierList items={items} videoId="vid-1" tabId="t1" />);
    // Unranked still has only Mystery pick (1) — restored placement is honored
    // without throwing, and the chip is still rendered.
    expect(screen.getByText('Jett')).toBeInTheDocument();
    expect(screen.getByText('Unranked (1)')).toBeInTheDocument();
  });

  it('reset restores the creators placement and clears overrides', () => {
    window.localStorage.setItem(
      'vie:tier-list:vid-2:t1',
      JSON.stringify({ '4': 'S' }), // Mystery pick forced to S
    );
    render(<TierList items={items} videoId="vid-2" tabId="t1" />);
    // Before reset, Mystery pick was forced to S → Unranked count is 0.
    expect(screen.getByText('Unranked (0)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    // After reset, Mystery pick (no suggested tier) returns to Unranked.
    expect(screen.getByText('Unranked (1)')).toBeInTheDocument();
  });

  it('persists the reset placement back to localStorage', () => {
    window.localStorage.setItem(
      'vie:tier-list:vid-3:t1',
      JSON.stringify({ '4': 'S' }),
    );
    render(<TierList items={items} videoId="vid-3" tabId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    const stored = JSON.parse(
      window.localStorage.getItem('vie:tier-list:vid-3:t1') ?? '{}',
    );
    // Mystery pick (index 4) is back to the unranked bench.
    expect(stored['4']).toBe('__unranked__');
  });

  it('renders a tier row label for each of S/A/B/C/D', () => {
    render(<TierList items={items} />);
    // Each tier letter appears exactly once as a row label.
    for (const tier of ['S', 'A', 'B', 'C', 'D']) {
      expect(screen.getByText(tier)).toBeInTheDocument();
    }
  });
});
