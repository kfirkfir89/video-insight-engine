import { memo, useMemo } from 'react';
import { Wrench, ListChecks, Clock, Lightbulb, Hammer } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface DIYViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for DIY/crafts content.
 * Emphasizes:
 * - Tools and materials at the top
 * - Step-by-step instructions
 * - Safety tips
 * - Video timestamps for demonstrations
 */
export const DIYView = memo(function DIYView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: DIYViewProps) {
  // Group blocks by type for DIY-optimized layout
  const { toolBlocks, materialBlocks, stepBlocks, tipBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const tools: ContentBlock[] = [];
    const materials: ContentBlock[] = [];
    const steps: ContentBlock[] = [];
    const tips: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of chapter.content ?? []) {
      if (block.type === 'tool_list') {
        tools.push(block);
      } else if (block.type === 'bullets' && block.variant === 'materials') {
        materials.push(block);
      } else if (block.type === 'numbered' && block.variant === 'steps') {
        steps.push(block);
      } else if (block.type === 'step') {
        steps.push(block);
      } else if (block.type === 'callout' && (block.variant === 'safety_tip' || block.variant === 'pro_tip')) {
        tips.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      toolBlocks: tools,
      materialBlocks: materials,
      stepBlocks: steps,
      tipBlocks: tips,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [chapter.content]);

  const hasTools = toolBlocks.length > 0;
  const hasMaterials = materialBlocks.length > 0;
  const hasSteps = stepBlocks.length > 0;
  const hasTips = tipBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasTools && !hasMaterials && !hasSteps && !hasTips && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Tools & Materials Section */}
      {(hasTools || hasMaterials) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Tools */}
          {hasTools && (
            <div className="glass-panel block-entrance" style={{ animationDelay: '0ms' }}>
              <h4 className="glass-section-header">
                <Wrench className="h-4 w-4" aria-hidden="true" />
                <span>Tools Needed</span>
              </h4>
              <ContentBlocks
                blocks={toolBlocks}
                onPlay={onPlay}
                onStop={onStop}
                isVideoActive={isVideoActive}
                activeStartSeconds={activeStartSeconds}
              />
            </div>
          )}

          {/* Materials */}
          {hasMaterials && (
            <div className="glass-panel block-entrance" style={{ animationDelay: '50ms' }}>
              <h4 className="glass-section-header">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                <span>Materials</span>
              </h4>
              <ContentBlocks
                blocks={materialBlocks}
                onPlay={onPlay}
                onStop={onStop}
                isVideoActive={isVideoActive}
                activeStartSeconds={activeStartSeconds}
              />
            </div>
          )}
        </div>
      )}

      {/* Main content (non-categorized blocks) */}
      {hasOtherBlocks && (
        <ContentBlocks
          blocks={otherBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Step-by-Step Instructions */}
      {hasSteps && (
        <div className="glass-panel block-entrance" style={{ animationDelay: '100ms' }}>
          <h4 className="glass-section-header">
            <Hammer className="h-4 w-4" aria-hidden="true" />
            <span>Instructions</span>
          </h4>
          <ContentBlocks
            blocks={stepBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Timestamps for Demonstrations */}
      {hasTimestamps && (
        <div className="mt-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Key Steps</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            <ContentBlocks
              blocks={timestampBlocks}
              onPlay={onPlay}
              onStop={onStop}
              isVideoActive={isVideoActive}
              activeStartSeconds={activeStartSeconds}
            />
          </div>
        </div>
      )}

      {/* Safety & Pro Tips */}
      {hasTips && (
        <div className="mt-4 space-y-2">
          <h4 className="glass-section-header">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>Tips & Safety</span>
          </h4>
          <ContentBlocks
            blocks={tipBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}
    </div>
  );
});
