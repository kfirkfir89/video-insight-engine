import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import { Check, Link2, RotateCcw, Trophy, X } from 'lucide-react';

import { VieCanvas } from '@/components/vie/canvas/CanvasShell';
import { GlassCard, Badge } from '@/components/vie';
import { EmptyTabState } from './EmptyTabState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ConnectPair } from '@vie/types';

// ─── Props ───

interface ConnectCanvasProps {
  pairs: ConnectPair[];
  videoId?: string;
  tabId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

// ─── Layout ───

const COLUMN_X = 260;
const ROW_SPACING = 96;

function leftNodeId(index: number): string {
  return `left-${index}`;
}

function rightNodeId(index: number): string {
  return `right-${index}`;
}

/** Deterministic shuffle (seeded by length) so the right column order is stable
 *  across re-renders but not aligned 1:1 with the left column. */
function shuffleIndices(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  // Simple deterministic rotation + swap — enough to break trivial alignment
  // without pulling in a PRNG. For count <= 1 it's a no-op.
  for (let i = count - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Repair fixed points so no answer sits directly across from its prompt
  // (which would let the user solve that row by connecting straight across).
  if (count > 1) {
    for (let i = 0; i < count; i += 1) {
      if (order[i] === i) {
        const swapWith = (i + 1) % count;
        [order[i], order[swapWith]] = [order[swapWith], order[i]];
      }
    }
  }
  return order;
}

/**
 * A connection is correct when the connected right node's underlying pair is
 * the same pair as the left node — i.e. `rightOrder[rightDisplayIdx] === leftIdx`.
 * We compare pair identity, NOT `match` text, so two pairs that happen to share
 * the same answer string can't both score as correct.
 */
function isCorrectConnection(
  leftIdx: number,
  rightDisplayIdx: number,
  rightOrder: number[],
): boolean {
  return (
    Number.isInteger(leftIdx) &&
    Number.isInteger(rightDisplayIdx) &&
    rightOrder[rightDisplayIdx] === leftIdx
  );
}

// ─── Persistence ───

function storageKey(videoId: string | undefined, tabId: string | undefined): string | null {
  if (!videoId) return null;
  return `vie:connect-canvas:${videoId}:${tabId ?? 'default'}`;
}

function readBestScore(videoId?: string, tabId?: string): number {
  const key = storageKey(videoId, tabId);
  if (!key || typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(videoId: string | undefined, tabId: string | undefined, score: number): void {
  const key = storageKey(videoId, tabId);
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(score));
  } catch {
    // Best-effort; ignore quota errors.
  }
}

// ─── Node ───

interface ColumnNodeData extends Record<string, unknown> {
  label: string;
  side: 'left' | 'right';
  state: 'idle' | 'correct' | 'wrong';
  graded: boolean;
}

const ColumnNode = memo(function ColumnNode({ data }: { data: ColumnNodeData }) {
  const { label, side, state, graded } = data;
  return (
    <div data-slot="vie-connect-node" className="relative">
      {side === 'right' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-full !min-h-[40px] !w-2.5 !-translate-x-1/2 !rounded-md !border-0 !bg-[var(--vie-accent,var(--primary))]/70 transition-colors hover:!bg-[var(--vie-accent,var(--primary))]"
        />
      )}
      <GlassCard
        variant="default"
        className={cn(
          'min-w-[180px] max-w-[220px] p-3 text-sm font-semibold text-foreground transition-colors',
          graded && state === 'correct' && 'border-success/60 bg-success/10',
          graded && state === 'wrong' && 'border-destructive/60 bg-destructive/10',
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex-1 leading-snug">{label}</span>
          {graded && state === 'correct' && (
            <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          )}
          {graded && state === 'wrong' && (
            <X className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
        </span>
      </GlassCard>
      {side === 'left' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-full !min-h-[40px] !w-2.5 !translate-x-1/2 !rounded-md !border-0 !bg-[var(--vie-accent,var(--primary))]/70 transition-colors hover:!bg-[var(--vie-accent,var(--primary))]"
        />
      )}
    </div>
  );
});

const NODE_TYPES: NodeTypes = { connectColumn: ColumnNode };

// ─── Grading ───

interface GradeResult {
  correct: number;
  total: number;
}

/**
 * Grade the user's connections against the answer key. A connection is correct
 * when the connected right node maps back to the left node's pair (compared by
 * pair identity, not answer text). Exported for unit testing — grading is pure
 * and doesn't need a mounted canvas.
 */
export function gradeConnections(
  pairs: ConnectPair[],
  rightOrder: number[],
  edges: Edge[],
): GradeResult {
  const total = pairs.length;
  let correct = 0;
  for (const edge of edges) {
    const leftIdx = Number(edge.source.replace('left-', ''));
    const rightIdx = Number(edge.target.replace('right-', ''));
    if (isCorrectConnection(leftIdx, rightIdx, rightOrder)) {
      correct += 1;
    }
  }
  return { correct, total };
}

// ─── Canvas ───

/**
 * Graded drag-to-connect quiz. Two columns of nodes — prompts on the left,
 * shuffled answers on the right. The user drags from a left handle to a right
 * handle to connect a matching pair. "Check" grades every connection against
 * the answer key (a pair is correct when the connected right node maps back to
 * the left node's pair), colours the nodes, and persists the best score per
 * video+tab in localStorage.
 *
 * Falls back to a friendly empty card when fewer than 2 pairs are provided —
 * a one-row match game is trivial.
 */
export const ConnectCanvas = memo(function ConnectCanvas({
  pairs,
  videoId,
  tabId,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: ConnectCanvasProps) {
  const cleanPairs = useMemo(
    () => (pairs ?? []).filter((p) => p && p.prompt?.trim() && p.match?.trim()),
    [pairs],
  );
  const rightOrder = useMemo(() => shuffleIndices(cleanPairs.length), [cleanPairs.length]);

  const [graded, setGraded] = useState(false);
  const [score, setScore] = useState<GradeResult | null>(null);
  const [bestScore, setBestScore] = useState(0);
  // Skeleton covers the blank mount window until React Flow reports it has
  // initialised + measured the viewport (onInit).
  const [canvasReady, setCanvasReady] = useState(false);
  const handleCanvasInit = useCallback(() => setCanvasReady(true), []);

  useEffect(() => {
    setBestScore(readBestScore(videoId, tabId));
  }, [videoId, tabId]);

  const initialNodes = useMemo<Node<ColumnNodeData>[]>(() => {
    const nodes: Node<ColumnNodeData>[] = [];
    cleanPairs.forEach((pair, index) => {
      nodes.push({
        id: leftNodeId(index),
        type: 'connectColumn',
        position: { x: 0, y: index * ROW_SPACING },
        data: { label: pair.prompt, side: 'left', state: 'idle', graded: false },
      });
    });
    rightOrder.forEach((pairIndex, displayIndex) => {
      nodes.push({
        id: rightNodeId(displayIndex),
        type: 'connectColumn',
        position: { x: COLUMN_X, y: displayIndex * ROW_SPACING },
        data: { label: cleanPairs[pairIndex].match, side: 'right', state: 'idle', graded: false },
      });
    });
    return nodes;
  }, [cleanPairs, rightOrder]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ColumnNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges([]);
    setGraded(false);
    setScore(null);
  }, [initialNodes, setNodes, setEdges]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (graded) return;
      // One connection per left source — replace any existing edge from it.
      setEdges((prev) => {
        const withoutSource = prev.filter((e) => e.source !== connection.source);
        return addEdge(
          {
            ...connection,
            type: 'smoothstep',
            style: { stroke: 'var(--vie-accent, var(--primary))', strokeWidth: 1.6 },
          },
          withoutSource,
        );
      });
    },
    [graded, setEdges],
  );

  const handleCheck = useCallback(() => {
    const result = gradeConnections(cleanPairs, rightOrder, edges);
    setScore(result);
    setGraded(true);
    if (result.correct > bestScore) {
      setBestScore(result.correct);
      writeBestScore(videoId, tabId, result.correct);
    }
    // Colour nodes + edges by correctness.
    const correctLeft = new Set<string>();
    const correctRight = new Set<string>();
    for (const edge of edges) {
      const leftIdx = Number(edge.source.replace('left-', ''));
      const rightIdx = Number(edge.target.replace('right-', ''));
      if (isCorrectConnection(leftIdx, rightIdx, rightOrder)) {
        correctLeft.add(edge.source);
        correctRight.add(edge.target);
      }
    }
    setNodes((prev) =>
      prev.map((node) => {
        const isConnected = edges.some((e) => e.source === node.id || e.target === node.id);
        const isCorrect = correctLeft.has(node.id) || correctRight.has(node.id);
        const state: ColumnNodeData['state'] = isCorrect ? 'correct' : isConnected ? 'wrong' : 'idle';
        return { ...node, data: { ...node.data, graded: true, state } };
      }),
    );
    setEdges((prev) =>
      prev.map((edge) => {
        const isCorrect = correctLeft.has(edge.source) && correctRight.has(edge.target);
        return {
          ...edge,
          style: {
            stroke: isCorrect ? 'var(--success)' : 'var(--destructive)',
            strokeWidth: 1.8,
          },
        };
      }),
    );
  }, [cleanPairs, rightOrder, edges, bestScore, videoId, tabId, setNodes, setEdges]);

  const handleReset = useCallback(() => {
    setEdges([]);
    setGraded(false);
    setScore(null);
    setNodes((prev) =>
      prev.map((node) => ({ ...node, data: { ...node.data, graded: false, state: 'idle' } })),
    );
  }, [setEdges, setNodes]);

  if (cleanPairs.length < 2) {
    return (
      <EmptyTabState
        message="Not enough connected concepts to build a matching quiz."
        icon={Link2}
      />
    );
  }

  const canvasHeight = Math.min(640, 160 + cleanPairs.length * ROW_SPACING);

  return (
    <div className="space-y-3" data-tab-id={tabId}>
      <GlassCard variant="outlined" className="flex flex-wrap items-center justify-between gap-2 p-3">
        <p className="text-sm text-muted-foreground">
          Drag from each prompt to its matching answer, then check your work.
        </p>
        <div className="flex items-center gap-2">
          {bestScore > 0 && (
            <Badge variant="muted" className="flex items-center gap-1 text-xs font-semibold">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              Best {bestScore}/{cleanPairs.length}
            </Badge>
          )}
          {graded && score && (
            <Badge
              variant={score.correct === score.total ? 'success' : 'info'}
              className="text-xs font-semibold tabular-nums"
              data-testid="connect-canvas-score"
            >
              {score.correct}/{score.total} correct
            </Badge>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleCheck}
            disabled={edges.length === 0 || graded}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--vie-accent,var(--primary))] px-3 py-1 text-xs font-semibold text-[var(--vie-accent-foreground)] transition-opacity disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Check
          </button>
        </div>
      </GlassCard>
      <div className="relative" style={{ height: canvasHeight }}>
        <VieCanvas
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onInit={handleCanvasInit}
          nodesDraggable={false}
          height={canvasHeight}
        />
        {!canvasReady && (
          <Skeleton
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl bg-muted/40 motion-reduce:animate-none"
          />
        )}
      </div>
    </div>
  );
});
