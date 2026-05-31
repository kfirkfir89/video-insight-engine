import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => (
    <div data-testid="celebration">{title}</div>
  ),
}));

import { PackingMission, type PackingItem } from '../PackingMission';

const items: PackingItem[] = [
  { item: 'Passport', essential: true, category: 'docs', weight: 0.1 },
  { item: 'Phone charger', essential: true, category: 'tech', weight: 0.2 },
  { item: 'T-shirt', category: 'clothes', weight: 0.3 },
  { item: 'Sunscreen', category: 'health', weight: 0.15 },
  { item: 'Book', category: 'leisure', weight: 0.4 },
];

describe('PackingMission', () => {
  it('should render all items in the remaining list initially', () => {
    render(<PackingMission items={items} />);
    expect(screen.getByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('Phone charger')).toBeInTheDocument();
    expect(screen.getByText('T-shirt')).toBeInTheDocument();
    expect(screen.getByText('Sunscreen')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('0 packed')).toBeInTheDocument();
  });

  it('should return null when items is empty', () => {
    const { container } = render(<PackingMission items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should move an item to the suitcase via the Pack button', () => {
    render(<PackingMission items={items} />);
    fireEvent.click(screen.getByLabelText('Pack Book'));
    // Book chip is now in suitcase — unpack button shown
    expect(screen.getByLabelText('Unpack Book')).toBeInTheDocument();
    // "Pack Book" is gone from remaining list
    expect(screen.queryByLabelText('Pack Book')).not.toBeInTheDocument();
  });

  it('should update the weight tally as items are packed', () => {
    render(<PackingMission items={items} />);
    // No suitcase total yet — only per-row weights show.
    expect(screen.queryByText('0.7 kg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Pack Book'));
    // Suitcase total now reads 0.4 kg (Book alone).
    expect(screen.getByText('0.4 kg')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Pack T-shirt'));
    // 0.4 + 0.3 = 0.7 — sum is rendered in the suitcase header.
    expect(screen.getByText('0.7 kg')).toBeInTheDocument();
  });

  it('should show the essentials warning when most non-essentials are packed but essentials remain', () => {
    render(<PackingMission items={items} />);
    // Pack the three non-essentials
    fireEvent.click(screen.getByLabelText('Pack T-shirt'));
    fireEvent.click(screen.getByLabelText('Pack Sunscreen'));
    fireEvent.click(screen.getByLabelText('Pack Book'));
    // Now 3 of 5 packed (60%), but all non-essentials are packed → warning fires
    expect(
      screen.getByText(/Don.t forget your essentials/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Passport, Phone charger')).toBeInTheDocument();
  });

  it('should render the celebration when all items are packed', () => {
    render(<PackingMission items={items} />);
    for (const it of items) {
      fireEvent.click(screen.getByLabelText(`Pack ${it.item}`));
    }
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
  });

  it('should move a packed chip back to remaining when clicked', () => {
    render(<PackingMission items={items} />);
    fireEvent.click(screen.getByLabelText('Pack Book'));
    expect(screen.queryByLabelText('Pack Book')).not.toBeInTheDocument();
    // Click the packed chip → unpacks
    fireEvent.click(screen.getByLabelText('Unpack Book'));
    expect(screen.getByLabelText('Pack Book')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unpack Book')).not.toBeInTheDocument();
  });

  it('should persist packed state to localStorage when videoId is provided', () => {
    const { unmount } = render(
      <PackingMission items={items} videoId="vid-123" />,
    );
    fireEvent.click(screen.getByLabelText('Pack Book'));
    unmount();
    // Re-mount with the same videoId — Book should still be in the suitcase
    render(<PackingMission items={items} videoId="vid-123" />);
    expect(screen.getByLabelText('Unpack Book')).toBeInTheDocument();
  });
});
