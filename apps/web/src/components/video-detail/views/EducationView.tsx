import { memo, useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface EducationViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for educational content.
 * Emphasizes:
 * - Key concepts/definitions at the top
 * - Formulas and equations
 * - Interactive quizzes
 * - Learning tips and callouts
 */
export const EducationView = memo(function EducationView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: EducationViewProps) {
  // Group blocks by type for education-optimized layout
  const { definitionBlocks, formulaBlocks, quizBlocks, tipBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const definitions: ContentBlock[] = [];
    const formulas: ContentBlock[] = [];
    const quizzes: ContentBlock[] = [];
    const tips: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of chapter.content ?? []) {
      if (block.type === 'definition') {
        definitions.push(block);
      } else if (block.type === 'formula') {
        formulas.push(block);
      } else if (block.type === 'quiz') {
        quizzes.push(block);
      } else if (block.type === 'callout' && block.variant === 'learning_tip') {
        tips.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      definitionBlocks: definitions,
      formulaBlocks: formulas,
      quizBlocks: quizzes,
      tipBlocks: tips,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [chapter.content]);

  const hasDefinitions = definitionBlocks.length > 0;
  const hasFormulas = formulaBlocks.length > 0;
  const hasQuizzes = quizBlocks.length > 0;
  const hasTips = tipBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasDefinitions && !hasFormulas && !hasQuizzes && !hasTips && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Key Definitions Section */}
      {hasDefinitions && (
        <ContentBlocks
          blocks={definitionBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
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

      {/* Formulas Section */}
      {hasFormulas && (
        <ContentBlocks
          blocks={formulaBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Quiz Section */}
      {hasQuizzes && (
        <ContentBlocks
          blocks={quizBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Timestamps for Key Explanations */}
      {hasTimestamps && (
        <div className="mt-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Key Explanations</span>
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

      {/* Learning Tips */}
      {hasTips && (
        <ContentBlocks
          blocks={tipBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}
    </div>
  );
});
