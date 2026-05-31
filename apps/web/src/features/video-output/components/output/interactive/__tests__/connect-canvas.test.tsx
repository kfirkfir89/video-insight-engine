import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Edge } from '@xyflow/react';
import type { ConnectPair } from '@vie/types';

import { ConnectCanvas, gradeConnections } from '../ConnectCanvas';

const pairs: ConnectPair[] = [
  { prompt: 'Embedding', match: 'Vector space' },
  { prompt: 'Attention', match: 'Token weighting' },
  { prompt: 'Residual', match: 'Skip connection' },
];

describe('ConnectCanvas', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render one node slot per prompt and per answer', () => {
    render(<ConnectCanvas pairs={pairs} videoId="vid1" tabId="connect" />);
    const nodes = document.querySelectorAll('[data-slot="vie-connect-node"]');
    // Two columns: one per prompt + one per (shuffled) answer.
    expect(nodes).toHaveLength(pairs.length * 2);
  });

  it('should render the empty fallback for fewer than two pairs', () => {
    render(<ConnectCanvas pairs={[{ prompt: 'A', match: 'B' }]} videoId="vid1" />);
    expect(
      screen.getByText(/Not enough connected concepts to build a matching quiz/i),
    ).toBeInTheDocument();
  });

  describe('gradeConnections', () => {
    // identity rightOrder: right node i shows pairs[i].match
    const identityOrder = [0, 1, 2];

    function edge(leftIdx: number, rightIdx: number): Edge {
      return {
        id: `e${leftIdx}-${rightIdx}`,
        source: `left-${leftIdx}`,
        target: `right-${rightIdx}`,
      };
    }

    it('should count a connection correct when the answer key matches', () => {
      // left-0 (Embedding → Vector space) connected to the right node showing
      // "Vector space" (right-0 under identity order) is correct.
      const result = gradeConnections(pairs, identityOrder, [edge(0, 0)]);
      expect(result).toEqual({ correct: 1, total: 3 });
    });

    it('should count a wrong connection as incorrect', () => {
      // left-0 connected to right-1 ("Token weighting") is wrong.
      const result = gradeConnections(pairs, identityOrder, [edge(0, 1)]);
      expect(result).toEqual({ correct: 0, total: 3 });
    });

    it('should grade a fully correct board with a shuffled right column', () => {
      // Right column shuffled: display index 0 shows pairs[2].match, etc.
      const shuffled = [2, 0, 1];
      const edges = [
        edge(0, 1), // Embedding → display index showing pairs[0].match
        edge(1, 2), // Attention → pairs[1].match
        edge(2, 0), // Residual  → pairs[2].match
      ];
      const result = gradeConnections(pairs, shuffled, edges);
      expect(result).toEqual({ correct: 3, total: 3 });
    });

    it('should NOT count a duplicate-answer mismatch as correct (regression)', () => {
      // Two pairs share the same answer text. Connecting prompt A to the answer
      // node belonging to prompt B must be wrong — grading compares pair
      // identity, not answer text (which would false-positive here).
      const dupPairs: ConnectPair[] = [
        { prompt: 'A', match: 'Same answer' },
        { prompt: 'B', match: 'Same answer' },
        { prompt: 'C', match: 'Unique' },
      ];
      const identity = [0, 1, 2];
      // left-0 → right-1: same match text, but it's B's answer node → wrong.
      expect(gradeConnections(dupPairs, identity, [edge(0, 1)])).toEqual({
        correct: 0,
        total: 3,
      });
      // left-0 → right-0: A's own answer node → correct.
      expect(gradeConnections(dupPairs, identity, [edge(0, 0)])).toEqual({
        correct: 1,
        total: 3,
      });
    });
  });

  it('should persist a best score to localStorage under the video+tab key', () => {
    // Pre-seed a best score; the component reads it on mount and surfaces it.
    localStorage.setItem('vie:connect-canvas:vid1:connect', JSON.stringify(2));
    render(<ConnectCanvas pairs={pairs} videoId="vid1" tabId="connect" />);
    expect(screen.getByText(/Best 2\/3/)).toBeInTheDocument();
  });
});
