import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DiagramCard, buildDiagramEdges } from '../DiagramCard';

const nodes = [
  { label: 'Client', detail: 'Sends request', emoji: '💻' },
  { label: 'Gateway', detail: 'Auth + route' },
  { label: 'Service' },
];

describe('DiagramCard', () => {
  it('renders one read-only node slot per node', () => {
    render(<DiagramCard nodes={nodes} />);
    const slots = document.querySelectorAll('[data-slot="vie-diagram-node"]');
    expect(slots).toHaveLength(nodes.length);
  });

  it('renders each node label', () => {
    render(<DiagramCard nodes={nodes} />);
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Gateway')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
  });

  it('renders node detail when present', () => {
    render(<DiagramCard nodes={nodes} />);
    expect(screen.getByText('Sends request')).toBeInTheDocument();
  });

  it('mounts a read-only ReactFlow canvas', () => {
    render(<DiagramCard nodes={nodes} />);
    expect(document.querySelector('[data-slot="vie-canvas"]')).not.toBeNull();
    expect(document.querySelector('.react-flow__edges')).not.toBeNull();
  });

  it('renders the caption when provided', () => {
    render(<DiagramCard nodes={nodes} caption="Request lifecycle" />);
    expect(screen.getByText('Request lifecycle')).toBeInTheDocument();
  });

  it('renders nothing when every node lacks a label', () => {
    const { container } = render(<DiagramCard nodes={[{ label: '' }]} />);
    expect(container.innerHTML).toBe('');
  });

  describe('buildDiagramEdges', () => {
    it('falls back to a sequential chain when no edges are given', () => {
      const edges = buildDiagramEdges(3);
      expect(edges.map((e) => `${e.source}->${e.target}`)).toEqual([
        'diagram-0->diagram-1',
        'diagram-1->diagram-2',
      ]);
    });

    it('uses explicit edges when provided', () => {
      const edges = buildDiagramEdges(3, [
        { source: 0, target: 2 },
        { source: 1, target: 0 },
      ]);
      expect(edges.map((e) => `${e.source}->${e.target}`)).toEqual([
        'diagram-0->diagram-2',
        'diagram-1->diagram-0',
      ]);
    });

    it('drops self, out-of-range, and invalid explicit edges', () => {
      const edges = buildDiagramEdges(2, [
        { source: 0, target: 0 }, // self
        { source: 0, target: 5 }, // out of range
        { source: 1, target: 0 }, // valid
      ]);
      expect(edges.map((e) => `${e.source}->${e.target}`)).toEqual(['diagram-1->diagram-0']);
    });
  });
});
