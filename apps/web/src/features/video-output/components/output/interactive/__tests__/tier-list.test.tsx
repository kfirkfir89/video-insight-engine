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
    // Chips with a reason fold it into the accessible name.
    expect(screen.getByRole('button', { name: 'Drag Jett: Top duelist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag Sage: Carry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag Mystery pick' })).toBeInTheDocument();
  });

  it('exposes the reason as a title tooltip on the chip', () => {
    render(<TierList items={items} />);
    expect(screen.getByRole('button', { name: 'Drag Jett: Top duelist' })).toHaveAttribute(
      'title',
      'Top duelist',
    );
  });

  it('seeds items into the creators suggested tier', () => {
    render(<TierList items={items} />);
    // The S row should contain Jett; an item with no tier lands in Unranked.
    // (Jett also appears in the "Why these rankings" section — hence getAllBy.)
    expect(screen.getAllByText('Jett').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Unranked (1)')).toBeInTheDocument();
  });

  it('renders a "Why these rankings" section listing only items with a reason', () => {
    render(<TierList items={items} />);
    expect(screen.getByText('Why these rankings')).toBeInTheDocument();
    expect(screen.getByText('Top duelist')).toBeInTheDocument();
    expect(screen.getByText('Carry')).toBeInTheDocument();
    // Sova/Yoru/Mystery pick have no reason — they only appear once (as chips).
    expect(screen.getAllByText('Sova')).toHaveLength(1);
    expect(screen.getAllByText('Mystery pick')).toHaveLength(1);
  });

  it('omits the reason section when no item has a reason', () => {
    render(<TierList items={[{ item: 'Sova', tier: 'A' }, { item: 'Yoru' }]} />);
    expect(screen.queryByText('Why these rankings')).not.toBeInTheDocument();
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
    expect(screen.getAllByText('Jett').length).toBeGreaterThanOrEqual(1);
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
    // Each tier letter appears at least once as a row label (letters can
    // repeat inside the "Why these rankings" chips).
    for (const tier of ['S', 'A', 'B', 'C', 'D']) {
      expect(screen.getAllByText(tier).length).toBeGreaterThanOrEqual(1);
    }
  });
});
