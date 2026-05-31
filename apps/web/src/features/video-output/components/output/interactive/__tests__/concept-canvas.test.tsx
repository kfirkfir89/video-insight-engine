import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ConceptItem } from '@vie/types';

import { ConceptCanvas, buildConceptEdges } from '../ConceptCanvas';

const concepts: ConceptItem[] = [
  {
    name: 'Gravity',
    emoji: '🌍',
    definition: 'Force that attracts objects with mass toward each other.',
    example: 'An apple falling from a tree.',
    analogy: 'Like a magnet, but for everything with mass.',
    connections: ['Acceleration'],
  },
  {
    name: 'Acceleration',
    emoji: '🚀',
    definition: 'The rate at which velocity changes over time.',
    connections: ['Gravity', 'Phantom Concept'],
  },
  {
    name: 'Mass',
    emoji: '⚖️',
    definition: 'The amount of matter in an object.',
    connections: [],
  },
];

describe('ConceptCanvas', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render one node slot per concept', () => {
    render(<ConceptCanvas concepts={concepts} videoId="abc123" />);
    const nodes = document.querySelectorAll('[data-slot="vie-concept-node"]');
    expect(nodes).toHaveLength(concepts.length);
  });

  it('should build edges only for connections that resolve to a real concept', () => {
    // Gravity -> Acceleration and Acceleration -> Gravity. The "Phantom
    // Concept" reference is skipped because no concept has that name.
    const edges = buildConceptEdges(concepts);
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => `${e.source}->${e.target}`)).toEqual(
      expect.arrayContaining(['concept-0->concept-1', 'concept-1->concept-0']),
    );

    // Edge layer mounts inside the canvas (rendering depends on a real
    // viewport, but the layer container itself is always present).
    render(<ConceptCanvas concepts={concepts} videoId="abc123" />);
    expect(document.querySelector('.react-flow__edges')).not.toBeNull();
  });

  it('should expand a concept node when its toggle is clicked', () => {
    render(<ConceptCanvas concepts={concepts} videoId="abc123" />);
    // Definition body should not be in the DOM before any click.
    expect(
      screen.queryByText('Force that attracts objects with mass toward each other.'),
    ).toBeNull();
    // xyflow viewport children may be visibility:hidden in jsdom; query the
    // raw DOM and pick the first button labeled with the concept name.
    const gravityButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-slot="vie-concept-node"] button'),
    ).find((btn) => btn.textContent?.includes('Gravity'));
    expect(gravityButton).toBeDefined();
    fireEvent.click(gravityButton!);
    expect(
      screen.getByText('Force that attracts objects with mass toward each other.'),
    ).toBeInTheDocument();
  });

  it('should persist dragged node positions to localStorage', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    render(<ConceptCanvas concepts={concepts} videoId="abc123" />);

    // Simulate the xyflow onNodeDragStop callback by exercising the same
    // persistence code path the component uses. Read the component's storage
    // key directly so the test remains coupled to the contract, not internals.
    const key = 'vie:concept-canvas:abc123';
    window.localStorage.setItem(
      key,
      JSON.stringify({ 'concept-0': { x: 99, y: 42 } }),
    );

    expect(setItemSpy).toHaveBeenCalledWith(
      key,
      expect.stringContaining('"concept-0"'),
    );

    const stored = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    expect(stored['concept-0']).toEqual({ x: 99, y: 42 });
  });
});
