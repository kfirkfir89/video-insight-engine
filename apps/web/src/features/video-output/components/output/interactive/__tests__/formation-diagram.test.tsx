import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FormationDiagram } from '../FormationDiagram';
import type { FormationPosition } from '@vie/types';

const positions: FormationPosition[] = [
  { player: 'Ederson', role: 'GK', x: 50, y: 8, number: 31 },
  { player: 'Rodri', role: 'CDM', x: 50, y: 50, number: 16 },
  { player: 'Haaland', role: 'ST', x: 50, y: 90, number: 9 },
];

describe('FormationDiagram', () => {
  it('renders one read-only node per player', () => {
    render(<FormationDiagram positions={positions} />);
    const slots = document.querySelectorAll('[data-slot="vie-formation-node"]');
    expect(slots).toHaveLength(positions.length);
  });

  it('renders each player name', () => {
    render(<FormationDiagram positions={positions} />);
    expect(screen.getByText('Ederson')).toBeInTheDocument();
    expect(screen.getByText('Rodri')).toBeInTheDocument();
    expect(screen.getByText('Haaland')).toBeInTheDocument();
  });

  it('renders shirt numbers when present', () => {
    render(<FormationDiagram positions={positions} />);
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('mounts a read-only ReactFlow canvas', () => {
    render(<FormationDiagram positions={positions} />);
    expect(document.querySelector('[data-slot="vie-canvas"]')).not.toBeNull();
  });

  it('renders the team and formation name as a caption', () => {
    render(<FormationDiagram positions={positions} team="City" name="4-3-3" />);
    expect(screen.getByText('City · 4-3-3')).toBeInTheDocument();
  });

  it('falls back to the role when a player has no number', () => {
    render(
      <FormationDiagram
        positions={[
          { player: 'A', role: 'GK', x: 50, y: 8 },
          { player: 'B', role: 'CB', x: 40, y: 25 },
          { player: 'C', role: 'ST', x: 50, y: 90 },
        ]}
      />,
    );
    expect(screen.getByText('GK')).toBeInTheDocument();
  });

  it('renders an empty state when no player has a name', () => {
    const { container } = render(
      <FormationDiagram positions={[{ player: '', x: 10, y: 10 }]} />,
    );
    expect(container.textContent).toContain('No formation data was extracted');
  });
});
