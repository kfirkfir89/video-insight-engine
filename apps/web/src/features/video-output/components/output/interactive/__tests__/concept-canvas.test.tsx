import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConceptItem } from '@vie/types';

import { ConceptCanvas, buildConceptGraph } from '../ConceptCanvas';

const concepts: ConceptItem[] = [
  {
    name: 'Gravity',
    emoji: '🌍',
    definition: 'Force that attracts objects with mass toward each other.',
    example: 'An apple falling from a tree.',
    group: 'Foundations',
    connections: [{ to: 'Acceleration', type: 'causes' }],
  },
  {
    name: 'Acceleration',
    emoji: '🚀',
    definition: 'The rate at which velocity changes over time.',
    group: 'Mechanics',
    connections: [{ to: 'Gravity', type: 'relatesTo' }, { to: 'Phantom Concept', type: 'causes' }],
  },
  {
    name: 'Mass',
    emoji: '⚖️',
    definition: 'The amount of matter in an object.',
    group: 'Foundations',
    connections: [],
  },
];

// Legacy cached shape — bare-string connections, no group.
const legacyConcepts: ConceptItem[] = [
  { name: 'Embedding', emoji: '🔢', definition: 'Maps tokens to vectors.', connections: ['Attention'] },
  { name: 'Attention', emoji: '👀', definition: 'Weights tokens.', connections: ['Embedding'] },
];

describe('buildConceptGraph', () => {
  it('builds typed edges and drops hallucinated + self references', () => {
    const model = buildConceptGraph(concepts, ['Foundations', 'Mechanics']);
    // Gravity↔Acceleration is one undirected edge; the "Phantom Concept" ref is dropped.
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ relation: 'causes' });
  });

  it('coerces legacy bare-string connections to relatesTo edges', () => {
    const model = buildConceptGraph(legacyConcepts);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0].relation).toBe('relatesTo');
  });

  it('returns ordered, de-duped group lanes', () => {
    const model = buildConceptGraph(concepts, ['Foundations', 'Mechanics']);
    expect(model.groups).toEqual(['Foundations', 'Mechanics']);
  });

  it('derives a default group lane for ungrouped legacy concepts', () => {
    const model = buildConceptGraph(legacyConcepts);
    expect(model.groups).toEqual(['Concepts']);
  });

  it('records undirected adjacency for the inspector', () => {
    const model = buildConceptGraph(concepts, ['Foundations', 'Mechanics']);
    const gravityNeighbors = model.adjacency.get('concept-0') ?? [];
    expect(gravityNeighbors.map((n) => n.name)).toContain('Acceleration');
  });
});

describe('ConceptCanvas', () => {
  it('renders the empty fallback when there are no concepts', () => {
    render(<ConceptCanvas concepts={[]} />);
    expect(screen.getByText(/No concepts to map yet/i)).toBeInTheDocument();
  });

  it('renders a sparse graph (concepts with no connections → no edges, no crash)', () => {
    const sparse: ConceptItem[] = [
      { name: 'Alpha', emoji: '🅰️', definition: 'First.', connections: [] },
      { name: 'Beta', emoji: '🅱️', definition: 'Second.', connections: [] },
    ];
    render(<ConceptCanvas concepts={sparse} />);
    // Falls back to a single derived "Concepts" lane with zero links.
    expect(screen.getByTestId('concept-canvas-counts')).toHaveTextContent(
      '2 concepts · 1 groups · 0 links',
    );
    expect(screen.getByRole('heading', { name: 'Concepts' })).toBeInTheDocument();
  });

  it('shows a header strip with concept, group and link counts', () => {
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    expect(screen.getByTestId('concept-canvas-counts')).toHaveTextContent(
      '3 concepts · 2 groups · 1 links',
    );
  });

  it('defaults to the Groups list view on mobile (matchMedia → not desktop)', () => {
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    // Group headings are present; the canvas node layer is not.
    expect(screen.getByRole('heading', { name: 'Foundations' })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="vie-concept-node"]')).toBeNull();
  });

  it('switches to the Map view and renders one node per concept', async () => {
    const user = userEvent.setup();
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    await user.click(screen.getByRole('tab', { name: /map/i }));
    expect(document.querySelectorAll('[data-slot="vie-concept-node"]')).toHaveLength(concepts.length);
  });

  it('gives each node hidden source + target handles (regression: floating edges need anchors)', async () => {
    // Without handles on the (handle-less) compact nodes, React Flow logs
    // error #008 ("Couldn't create edge for source handle id: null") and draws
    // ZERO edges — the typed-edge feature silently breaks. Each node must carry
    // one source + one target handle (hidden) for the floating edges to anchor.
    // (jsdom can't render RF's measured edge layer, so we assert the anchors.)
    const user = userEvent.setup();
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    await user.click(screen.getByRole('tab', { name: /map/i }));
    const nodes = document.querySelectorAll('[data-slot="vie-concept-node"]');
    nodes.forEach((node) => {
      expect(node.querySelectorAll('.react-flow__handle.source').length).toBe(1);
      expect(node.querySelectorAll('.react-flow__handle.target').length).toBe(1);
    });
  });

  it('opens the inspector (outside the node tree) when a concept is selected', async () => {
    const user = userEvent.setup();
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    // No inspector before selection.
    expect(document.querySelector('[data-slot="canvas-inspector"]')).toBeNull();
    // Select Gravity from the (default) Groups list.
    await user.click(screen.getByRole('button', { name: /Gravity/ }));
    const inspector = document.querySelector('[data-slot="canvas-inspector"]');
    expect(inspector).not.toBeNull();
    expect(
      within(inspector as HTMLElement).getByText(
        'Force that attracts objects with mass toward each other.',
      ),
    ).toBeInTheDocument();
  });

  it('locks node dragging in the Map view (no infinite drag)', async () => {
    const user = userEvent.setup();
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    await user.click(screen.getByRole('tab', { name: /map/i }));
    // ReactFlow tags draggable nodes with a `draggable` class; locked nodes have none.
    expect(document.querySelectorAll('.react-flow__node.draggable')).toHaveLength(0);
  });

  it('does not persist any layout to localStorage (feature dropped)', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    render(<ConceptCanvas concepts={concepts} groups={['Foundations', 'Mechanics']} />);
    fireEvent.click(screen.getByRole('button', { name: /Gravity/ }));
    expect(setItemSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('concept-canvas'),
      expect.anything(),
    );
    setItemSpy.mockRestore();
  });
});
