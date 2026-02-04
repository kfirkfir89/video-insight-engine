import { memo, useMemo } from 'react';
import { HelpCircle, Calculator, BookOpen, Clock, Lightbulb } from 'lucide-react';
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
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-4 border border-indigo-200/50 dark:border-indigo-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-3">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Key Concepts</span>
          </h4>
          <ContentBlocks
            blocks={definitionBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
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

      {/* Formulas Section */}
      {hasFormulas && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200/50 dark:border-emerald-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-3">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            <span>Formulas & Equations</span>
          </h4>
          <ContentBlocks
            blocks={formulaBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Quiz Section */}
      {hasQuizzes && (
        <div className="bg-violet-50/50 dark:bg-violet-950/20 rounded-lg p-4 border border-violet-200/50 dark:border-violet-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300 mb-3">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>Knowledge Check</span>
          </h4>
          <ContentBlocks
            blocks={quizBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
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
        <div className="mt-4 space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>Learning Tips</span>
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
