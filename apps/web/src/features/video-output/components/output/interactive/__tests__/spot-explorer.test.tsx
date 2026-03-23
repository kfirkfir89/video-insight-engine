import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { SpotExplorer } from '../SpotExplorer';

const spots = [
  { name: 'Eiffel Tower', emoji: '🗼', description: 'Iconic landmark', rating: 4.8, cost: '$$$', duration: '2 hours', mapQuery: 'Eiffel Tower Paris' },
  { name: 'Louvre', emoji: '🎨', description: 'World famous museum', tips: 'Go early to avoid crowds' },
  { name: 'Notre Dame', emoji: '⛪', description: 'Historic cathedral' },
];

describe('SpotExplorer', () => {
  it('should render all spots', () => {
    render(<SpotExplorer spots={spots} />);
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
    expect(screen.getByText('Louvre')).toBeInTheDocument();
    expect(screen.getByText('Notre Dame')).toBeInTheDocument();
  });

  it('should return null for empty spots', () => {
    const { container } = render(<SpotExplorer spots={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show rating when present', () => {
    render(<SpotExplorer spots={spots} />);
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('should show cost badge', () => {
    render(<SpotExplorer spots={spots} />);
    expect(screen.getByText('$$$')).toBeInTheDocument();
  });

  it('should show duration', () => {
    render(<SpotExplorer spots={spots} />);
    expect(screen.getByText('2 hours')).toBeInTheDocument();
  });

  it('should expand spot on click to show description', () => {
    render(<SpotExplorer spots={spots} />);
    fireEvent.click(screen.getByText('Eiffel Tower').closest('button')!);
    expect(screen.getByText('Iconic landmark')).toBeInTheDocument();
  });

  it('should show section nav when sections provided', () => {
    const sections = [
      { label: 'Day 1: Paris', spotIndices: [0, 1] },
      { label: 'Day 2: Paris', spotIndices: [2] },
    ];
    render(<SpotExplorer spots={spots} sections={sections} />);
    // Section label appears in both SectionNav and section header
    expect(screen.getAllByText('Day 1: Paris').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Day 2: Paris').length).toBeGreaterThanOrEqual(1);
  });
});
