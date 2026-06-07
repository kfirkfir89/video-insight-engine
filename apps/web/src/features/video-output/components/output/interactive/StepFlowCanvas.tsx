import { memo, useCallback, useEffect, useMemo } from 'react';
import {
  Handle,
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';

import { Clock } from 'lucide-react';

import { VieCanvas } from '@/components/vie/canvas/CanvasShell';
import { GlassCard, VisualEvidence } from '@/components/vie';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useTabState } from '@/features/video-output/contexts/TabStateContext';
import type { StepItem } from '@vie/types';

// ─── Props ───

interface StepFlowCanvasProps {
  steps: StepItem[];
  onSeek?: (seconds: number) => void;
  tabId?: string;
}

// ─── Helpers ───

const COLUMN_OFFSET = 180;
const ROW_SPACING = 160;

function stepNodeId(index: number): string {
  return `step-${index}`;
}

/** Vertical zigzag layout — alternates between left and right of center. */
export function zigzagLayout(count: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, index) => ({
    x: index % 2 === 0 ? -COLUMN_OFFSET : COLUMN_OFFSET,
    y: index * ROW_SPACING,
  }));
}

function parseDurationSeconds(duration?: string | number): number {
  if (duration == null) return 0;
  if (typeof duration === 'number') return duration;
  const match = duration.match(/(\d+)\s*(min|minute|m|sec|second|s|hr|hour|h)/i);
  if (!match) return 0;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('h')) return val * 3600;
  if (unit.startsWith('m')) return val * 60;
  return val;
}

/** Compact human label for the step-duration chip — "5 min" / "45s" / "1h 10m". */
function formatDurationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

// ─── Node ───

interface StepNodeData extends Record<string, unknown> {
  step: StepItem;
  index: number;
  completed: boolean;
  durationSeconds: number;
  onToggle: (index: number, completed: boolean) => void;
  onSeek?: (seconds: number) => void;
}

const StepNode = memo(function StepNode({ data }: { data: StepNodeData }) {
  const { step, index, completed, durationSeconds, onToggle, onSeek } = data;
  const stepNumber = step.number ?? index + 1;
  return (
    <div data-slot="vie-step-node" className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[var(--vie-accent,var(--primary))]"
      />
      <GlassCard
        variant={completed ? 'subtle' : 'default'}
        className={cn(
          'w-[260px] p-3 transition-colors',
          completed && 'opacity-80',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
              completed
                ? 'border-success bg-success text-success-foreground'
                : 'border-[color:var(--vie-accent,var(--primary))]/50 text-[color:var(--vie-accent,var(--primary))]',
            )}
            aria-hidden="true"
          >
            {stepNumber}
          </span>
          <div className="flex-1 min-w-0 space-y-2">
            {step.title && (
              <h4 className={cn('text-sm font-semibold leading-snug', completed && 'line-through')}>
                {step.title}
              </h4>
            )}
            {(step.thumbnailUrl || step.frameCaption || step.frameOcr) && (
              <VisualEvidence
                variant="figure"
                thumbnailUrl={step.thumbnailUrl}
                caption={step.frameCaption}
                ocr={step.frameOcr}
                sceneType={step.frameSceneType}
                timestamp={step.timestamp}
                onSeek={onSeek}
              />
            )}
            <p
              className={cn(
                'text-xs leading-snug text-muted-foreground line-clamp-3',
                completed && 'line-through',
              )}
            >
              {step.instruction}
            </p>
            {durationSeconds > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {formatDurationLabel(durationSeconds)}
              </span>
            )}
            <label className="flex items-center gap-2 pt-1 text-xs font-medium text-foreground/80">
              <Checkbox
                checked={completed}
                onCheckedChange={() => onToggle(index, completed)}
                aria-label={
                  completed
                    ? `Mark step ${stepNumber} incomplete`
                    : `Mark step ${stepNumber} complete`
                }
              />
              <span>{completed ? 'Done' : 'Mark complete'}</span>
            </label>
          </div>
        </div>
      </GlassCard>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[var(--vie-accent,var(--primary))]"
      />
    </div>
  );
});

const NODE_TYPES: NodeTypes = { step: StepNode };

// ─── Canvas ───

/**
 * Step-by-step recipe / tutorial flow rendered on an xyflow canvas in a
 * vertical zigzag. Each step renders as a draggable card with thumbnail,
 * instruction body, optional inline `Timer`, and an inline checkbox that
 * syncs completion state with `useTabState` so other tabs stay in sync with
 * StepByStepInteractive.
 *
 * Edges between consecutive steps animate when both endpoints are complete.
 */
export const StepFlowCanvas = memo(function StepFlowCanvas({
  steps,
  onSeek,
  tabId = 'steps',
}: StepFlowCanvasProps) {
  const tabState = useTabState();
  // Completion lives in the shared TabStateContext (single source of truth) so
  // this canvas and StepByStepInteractive stay in sync, and pre-existing
  // completions are reflected the moment the canvas mounts. `completedSteps`
  // gets a fresh identity on every change, which drives the sync effect below.
  const completedSteps = tabState.completedSteps;

  const toggleComplete = useCallback(
    (index: number, isCompleted: boolean) => {
      if (isCompleted) {
        tabState.uncompleteStep(index);
      } else {
        tabState.completeStep(index);
      }
    },
    [tabState],
  );

  const initialNodes = useMemo<Node<StepNodeData>[]>(() => {
    if (!steps?.length) return [];
    const positions = zigzagLayout(steps.length);
    return steps.map((step, index) => ({
      id: stepNodeId(index),
      type: 'step',
      position: positions[index],
      data: {
        step,
        index,
        completed: false,
        durationSeconds: parseDurationSeconds(step.duration),
        onToggle: toggleComplete,
        onSeek,
      },
    }));
    // toggleComplete is stable per render of this hook because tabState is
    // memoized; onSeek changes infrequently. We re-create nodes only when the
    // step shape changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, onSeek]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!steps?.length) return [];
    return steps.slice(1).map((_, index) => {
      const sourceIndex = index;
      const targetIndex = index + 1;
      return {
        id: `${stepNodeId(sourceIndex)}->${stepNodeId(targetIndex)}`,
        source: stepNodeId(sourceIndex),
        target: stepNodeId(targetIndex),
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--border)', strokeWidth: 1.4 },
      };
    });
  }, [steps]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Sync per-node `completed` flag + animate edges where both endpoints are
  // complete. Re-runs when completion changes OR when the nodes/edges are
  // rebuilt (steps changed), so a fresh node set picks up existing completion.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: {
          ...node.data,
          completed: completedSteps.has(node.data.index),
        },
      })),
    );
    setEdges((prev) =>
      prev.map((edge) => {
        const sourceIndex = Number(edge.source.replace('step-', ''));
        const targetIndex = Number(edge.target.replace('step-', ''));
        const animated = completedSteps.has(sourceIndex) && completedSteps.has(targetIndex);
        return {
          ...edge,
          animated,
          style: animated
            ? { stroke: 'var(--vie-accent, var(--primary))', strokeWidth: 1.8 }
            : { stroke: 'var(--border)', strokeWidth: 1.4 },
        };
      }),
    );
  }, [completedSteps, initialNodes, initialEdges, setNodes, setEdges]);

  if (!steps?.length) {
    return (
      <GlassCard variant="outlined" className="text-center text-sm text-muted-foreground">
        No steps to render yet.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3" data-tab-id={tabId}>
      <VieCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable={false}
        height={Math.min(720, 280 + steps.length * 160)}
      />
    </div>
  );
});
