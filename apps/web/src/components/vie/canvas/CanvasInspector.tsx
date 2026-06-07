import { memo, useEffect } from 'react';
import { X } from 'lucide-react';

import { GlassCard } from '@/components/vie/cards/GlassCard';
import { VisualEvidence } from '@/components/vie/data/VisualEvidence';
import { Badge } from '@/components/vie/data/Badge';
import { cn } from '@/lib/utils';
import type { ConceptItem, ConceptRelation } from '@vie/types';

// ─── Props ───

export interface InspectorNeighbor {
  id: string;
  name: string;
  emoji?: string;
  relation: ConceptRelation;
}

export interface CanvasInspectorProps {
  concept: ConceptItem;
  neighbors: InspectorNeighbor[];
  onSelectNeighbor: (id: string) => void;
  onClose: () => void;
  onSeek?: (seconds: number) => void;
  /** Right dock on desktop, bottom sheet on mobile. */
  isDesktop: boolean;
}

const RELATION_LABEL: Record<ConceptRelation, string> = {
  causes: 'causes',
  requires: 'requires',
  contrasts: 'contrasts',
  partOf: 'part of',
  relatesTo: 'relates to',
};

// ─── Component ───

/**
 * Detail panel for the selected concept. Rendered **outside** the React Flow
 * node tree (a docked sibling over the canvas) so it is never trapped behind
 * node stacking — the original z-index bug. Opaque `GlassCard` (glass is rare:
 * only floating chrome blurs), high z-index, frame evidence @16:9 when present.
 */
export const CanvasInspector = memo(function CanvasInspector({
  concept,
  neighbors,
  onSelectNeighbor,
  onClose,
  onSeek,
  isDesktop,
}: CanvasInspectorProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasFrame = Boolean(concept.thumbnailUrl || concept.frameCaption || concept.frameOcr);

  return (
    <aside
      data-slot="canvas-inspector"
      aria-label={`Details for ${concept.name}`}
      className={cn(
        'absolute z-50 flex flex-col',
        isDesktop
          ? 'inset-y-3 end-3 w-[340px]'
          : 'inset-x-2 bottom-2 max-h-[72%]',
      )}
    >
      <GlassCard
        variant="elevated"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        <header className="flex items-start gap-2">
          <span className="text-2xl leading-none" aria-hidden="true">
            {concept.emoji || '💡'}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">{concept.name}</h3>
            {concept.group && (
              <Badge variant="muted" className="mt-1 text-[10px] font-medium">
                {concept.group}
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <p className="text-sm leading-snug text-foreground/90">{concept.definition}</p>

        {concept.example && (
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="me-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
              Example
            </span>
            {concept.example}
          </p>
        )}
        {concept.analogy && (
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="me-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
              Analogy
            </span>
            {concept.analogy}
          </p>
        )}

        {hasFrame && (
          <VisualEvidence
            variant="figure"
            thumbnailUrl={concept.thumbnailUrl}
            caption={concept.frameCaption}
            ocr={concept.frameOcr}
            sceneType={concept.frameSceneType}
            evidence={concept.frameEvidence}
            timestamp={concept.timestamp}
            onSeek={onSeek}
          />
        )}

        {neighbors.length > 0 && (
          <div className="mt-auto space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
              Connected
            </p>
            <div className="flex flex-wrap gap-1.5">
              {neighbors.map((neighbor) => (
                <button
                  key={neighbor.id}
                  type="button"
                  onClick={() => onSelectNeighbor(neighbor.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-border',
                    'bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground/90',
                    'transition-colors hover:border-[color:var(--vie-accent,var(--primary))]/60 hover:bg-muted/50',
                  )}
                >
                  {neighbor.emoji && (
                    <span aria-hidden="true">{neighbor.emoji}</span>
                  )}
                  <span className="truncate max-w-[120px]">{neighbor.name}</span>
                  <span className="text-[10px] text-muted-foreground">· {RELATION_LABEL[neighbor.relation]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    </aside>
  );
});
